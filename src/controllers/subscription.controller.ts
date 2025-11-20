import type { Response, NextFunction } from 'express';
import { HttpStatusCode } from 'axios';
import { AuthRequest } from '../types/AuthRequest';
import models from '../models';

type PaidPlan = 'starter' | 'pro' | 'enterprise';
type BillingInterval = 'monthly' | 'yearly';

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil((b.getTime() - a.getTime()) / msPerDay));
}

export async function getMySubscriptionController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({ success: false, message: 'No autenticado' });
      return;
    }

    const user = await models.user.findById(userId).select('subscription firstName lastName email');
    if (!user) {
      res.status(HttpStatusCode.NotFound).send({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    const snap = user.subscription || { plan: 'free', status: 'free' };
    const now = new Date();

    let remainingDays: number | null = null;
    let endsAt: Date | null = null;
    let isActive = false;
    let isOnTrial = false;
    let isExpired = false;

    if (snap.status === 'trialing' && snap.trialEnd) {
      endsAt = snap.trialEnd;
      remainingDays = daysBetween(now, snap.trialEnd);
      isOnTrial = true;
      isActive = true;
      isExpired = snap.trialEnd < now;
    } else if (snap.status === 'active' && snap.currentPeriodEnd) {
      endsAt = snap.currentPeriodEnd;
      remainingDays = daysBetween(now, snap.currentPeriodEnd);
      isActive = true;
      isExpired = snap.currentPeriodEnd < now;
    } else {
      isActive = snap.status === 'active' || snap.status === 'trialing';
    }

    res.status(HttpStatusCode.Ok).send({
      success: true,
      data: {
        user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email },
        snapshot: snap,
        derived: { isActive, isOnTrial, remainingDays, endsAt, isExpired }
      }
    });
  } catch (error) {
    console.error('Error en getMySubscriptionController:', error);
    next(error);
  }
}

export async function listMySubscriptionsController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({ success: false, message: 'No autenticado' });
      return;
    }

    const subs = await models.subscription.find({ user: userId }).sort({ createdAt: -1 });
    res.status(HttpStatusCode.Ok).send({ success: true, data: subs });
  } catch (error) {
    console.error('Error en listMySubscriptionsController:', error);
    next(error);
  }
}

export async function startSubscriptionController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({ success: false, message: 'No autenticado' });
      return;
    }

    const { plan, billingInterval, provider = 'payphone', trialDays = 0, priceId, amount, currency, nationalId, phone, address } = req.body as {
      plan: string; // permite alias del frontend como 'advanced'
      billingInterval: BillingInterval;
      provider?: 'payphone' | 'stripe' | 'manual';
      trialDays?: number;
      priceId?: string;
      amount?: number;
      currency?: string;
      nationalId?: string;
      phone?: string;
      address?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string };
    };

    // Normalizar alias de plan provenientes del frontend
    const normalized = (plan || '').toLowerCase();
    const planMap: Record<string, PaidPlan> = {
      starter: 'starter',
      pro: 'pro',
      enterprise: 'enterprise',
      advanced: 'pro' // alias de UI para el plan 'pro'
    };
    const normalizedPlan = planMap[normalized];

    if (!normalizedPlan) {
      res.status(HttpStatusCode.BadRequest).send({ success: false, message: 'plan inválido' });
      return;
    }
    if (!billingInterval || !['monthly', 'yearly'].includes(billingInterval)) {
      res.status(HttpStatusCode.BadRequest).send({ success: false, message: 'billingInterval inválido' });
      return;
    }

    const user = await models.user.findById(userId);
    if (!user) {
      res.status(HttpStatusCode.NotFound).send({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    // Validate required billing identity fields
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const hasAddress = address && (address.street || address.city || address.country);
    if (!nationalId || typeof nationalId !== 'string' || nationalId.trim().length < 5) {
      res.status(HttpStatusCode.BadRequest).send({ success: false, message: 'nationalId is required and must be valid' });
      return;
    }
    if (!phone || typeof phone !== 'string' || !phoneRegex.test(phone)) {
      res.status(HttpStatusCode.BadRequest).send({ success: false, message: 'phone is required and must be valid' });
      return;
    }
    if (!hasAddress || typeof address !== 'object') {
      res.status(HttpStatusCode.BadRequest).send({ success: false, message: 'address is required (include at least street, city, country)' });
      return;
    }

    // Insert billing identity into user if missing
    const patch: any = {};
    if (!user.nationalId) patch.nationalId = nationalId.trim();
    if (!user.phone) patch.phone = phone.trim();
    if (!user.address || (!user.address.street && !user.address.city && !user.address.country)) {
      patch.address = {
        street: address.street?.trim(),
        city: address.city?.trim(),
        state: address.state?.trim(),
        zipCode: address.zipCode?.trim(),
        country: address.country?.trim()
      };
    }
    if (Object.keys(patch).length > 0) {
      await models.user.updateOne({ _id: user._id }, { $set: patch });
    }

    const now = new Date();
    const initialStatus = trialDays && trialDays > 0 ? 'trialing' : 'active';

    // Verificar si existe una suscripción activa/trialing para reemplazarla
    const existingActive = await models.subscription.findOne({
      user: userId,
      status: { $in: ['trialing', 'active'] }
    });

    let trialStart: Date | undefined;
    let trialEnd: Date | undefined;
    let currentPeriodStart: Date | undefined;
    let currentPeriodEnd: Date | undefined;
    let nextBillingDate: Date | undefined;

    if (initialStatus === 'trialing') {
      trialStart = now;
      trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
      // Cobro y periodo inician al finalizar el trial
      nextBillingDate = trialEnd;
    } else {
      currentPeriodStart = now;
      currentPeriodEnd = billingInterval === 'monthly' ? addMonths(now, 1) : addYears(now, 1);
      nextBillingDate = currentPeriodEnd;
    }

    // Si existe una suscripción activa, reemplazar con nuevos datos
    if (existingActive) {
      existingActive.plan = normalizedPlan;
      existingActive.status = initialStatus;
      existingActive.provider = provider;
      existingActive.billingInterval = billingInterval;
      existingActive.priceId = priceId;
      existingActive.amount = amount;
      existingActive.currency = currency;
      existingActive.trialStart = trialStart;
      existingActive.trialEnd = trialEnd;
      existingActive.currentPeriodStart = currentPeriodStart;
      existingActive.currentPeriodEnd = currentPeriodEnd;
      existingActive.nextBillingDate = nextBillingDate;
      await existingActive.save();

      // Actualizar snapshot en el User
      user.subscription = {
        plan: normalizedPlan,
        status: initialStatus as any,
        provider,
        billingInterval,
        trialStart,
        trialEnd,
        currentPeriodStart,
        currentPeriodEnd,
        nextBillingDate,
      } as any;
      await user.save();

      res.status(HttpStatusCode.Ok).send({ success: true, message: 'Suscripción actualizada', data: existingActive });
      return;
    }

    const created = await models.subscription.create({
      user: userId,
      plan: normalizedPlan,
      status: initialStatus,
      provider,
      billingInterval,
      priceId,
      amount,
      currency,
      trialStart,
      trialEnd,
      currentPeriodStart,
      currentPeriodEnd,
      nextBillingDate
    });

    // Actualizar snapshot en el User
    user.subscription = {
      plan: normalizedPlan,
      status: initialStatus as any,
      provider,
      billingInterval,
      trialStart,
      trialEnd,
      currentPeriodStart,
      currentPeriodEnd,
      nextBillingDate,
    } as any;
    await user.save();

    res.status(HttpStatusCode.Created).send({ success: true, message: 'Suscripción creada', data: created });
  } catch (error) {
    console.error('Error en startSubscriptionController:', error);
    next(error);
  }
}

export async function cancelMySubscriptionController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({ success: false, message: 'No autenticado' });
      return;
    }

    const { immediate = false } = req.body as { immediate?: boolean };

    const sub = await models.subscription.findOne({
      user: userId,
      status: { $in: ['trialing', 'active'] }
    });

    if (!sub) {
      res.status(HttpStatusCode.NotFound).send({ success: false, message: 'No hay suscripción activa para cancelar' });
      return;
    }

    if (immediate) {
      sub.status = 'canceled' as any;
      sub.canceledAt = new Date();
      sub.cancelAtPeriodEnd = false;
      await sub.save();
      // Downgrade snapshot del usuario a free
      await models.user.findByIdAndUpdate(userId, { $set: { subscription: { plan: 'free', status: 'free' } } });
      res.status(HttpStatusCode.Ok).send({ success: true, message: 'Suscripción cancelada inmediatamente' });
      return;
    } else {
      sub.cancelAtPeriodEnd = true;
      await sub.save();
      res.status(HttpStatusCode.Ok).send({ success: true, message: 'Suscripción marcada para cancelar al final del periodo' });
      return;
    }
  } catch (error) {
    console.error('Error en cancelMySubscriptionController:', error);
    next(error);
  }
}

// Planes disponibles (público): solo nombre y precio, en USD
export async function getPlansController(_req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
  const plans = [
    { name: 'Free', price: 0, currency: 'USD' },
    { name: 'Starter', price: 18, currency: 'USD' },
    { name: 'Advanced', price: 49, currency: 'USD' }
  ];

  res.status(HttpStatusCode.Ok).send({ success: true, data: plans });
  return
}