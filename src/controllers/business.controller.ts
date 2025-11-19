import type { Response, NextFunction } from 'express';
import { HttpStatusCode } from 'axios';
import { Types } from 'mongoose';
import models from '../models';
import type { AuthRequest } from '../types/AuthRequest';
import crypto from 'crypto';

/**
 * @description Crea un nuevo negocio en la base de datos
 * @route POST /api/business
 */
export async function createBusinessController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, description, industry, website, phone, email, address } = req.body;
    const userId = req.user?.id;

    // 1. Validación de entrada básica
    if (!name) {
      res.status(HttpStatusCode.BadRequest).send({ 
        success: false,
        message: 'Business name is required' 
      });
      return;
    }

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({ 
        success: false,
        message: 'User authentication required' 
      });
      return;
    }

    // 2. Verificar si el usuario existe
    const user = await models.user.findById(userId);
    if (!user) {
      res.status(HttpStatusCode.NotFound).send({ 
        success: false,
        message: 'User not found' 
      });
      return;
    }

  // 3. Verificar si ya existe un negocio con el mismo nombre para este usuario
  const existingBusiness = await models.business.findOne({ 
    name: name.trim(), 
    owner: userId 
  });
  if (existingBusiness) {
    res.status(HttpStatusCode.Conflict).send({ 
      success: false,
      message: 'You already have a business with this name' 
    });
    return;
  }

  const plan = (user.subscription?.plan as 'free' | 'starter' | 'pro' | 'enterprise') || 'free';
  const planLimits: Record<'free' | 'starter' | 'pro' | 'enterprise', number> = {
    free: 1,
    starter: 5,
    pro: 15,
    enterprise: Number.MAX_SAFE_INTEGER
  };
  const ownedCount = await models.business.countDocuments({ owner: userId });
  if (ownedCount >= planLimits[plan]) {
    res.status(HttpStatusCode.Forbidden).send({ 
      success: false,
      message: 'Business creation limit reached for your plan.',
      data: {
        plan,
        limit: planLimits[plan],
        current: ownedCount
      }
    });
    return;
  }

    // 4. Validar email si se proporciona
    if (email) {
      const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      if (!emailRegex.test(email)) {
        res.status(HttpStatusCode.BadRequest).send({ 
          success: false,
          message: 'Please provide a valid email address' 
        });
        return;
      }
    }

    // 5. Validar website si se proporciona
    if (website) {
      const websiteRegex = /^https?:\/\/.+/;
      if (!websiteRegex.test(website)) {
        res.status(HttpStatusCode.BadRequest).send({ 
          success: false,
          message: 'Please provide a valid website URL (must start with http:// or https://)' 
        });
        return;
      }
    }

    // 6. Crear la nueva instancia del negocio
    const newBusiness = new models.business({
      name: name.trim(),
      description: description?.trim(),
      industry: industry?.trim(),
      website: website?.trim(),
      phone: phone?.trim(),
      email: email?.toLowerCase().trim(),
      address,
      owner: userId,
      employees: [],
      integrations: [],
      isActive: true
    });

    // 7. Guardar el negocio en la base de datos
    const savedBusiness = await newBusiness.save();

    // 8. Actualizar el usuario para agregar el negocio a su lista
    await models.user.findByIdAndUpdate(
      userId,
      { $push: { businesses: savedBusiness._id } },
      { new: true }
    );

    // 9. Preparar la respuesta al cliente
    const businessResponse = {
      id: savedBusiness._id,
      name: savedBusiness.name,
      description: savedBusiness.description,
      industry: savedBusiness.industry,
      website: savedBusiness.website,
      phone: savedBusiness.phone,
      email: savedBusiness.email,
      address: savedBusiness.address,
      owner: savedBusiness.owner,
      employees: savedBusiness.employees,
      integrations: savedBusiness.integrations,
      isActive: savedBusiness.isActive,
      createdAt: savedBusiness.createdAt
    };

    res.status(HttpStatusCode.Created).send({
      success: true,
      message: 'Business created successfully',
      data: businessResponse
    });

  } catch (error) {
    console.error('Error creating business:', error);
    next(error);
  }
}

export async function canCreateBusinessController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: 'User authentication required.'
      });
      return;
    }

    const user = await models.user.findById(userId);
    if (!user) {
      res.status(HttpStatusCode.NotFound).send({
        message: 'User not found.'
      });
      return;
    }

    const plan = (user.subscription?.plan as 'free' | 'starter' | 'pro' | 'enterprise') || 'free';
    const planLimits: Record<'free' | 'starter' | 'pro' | 'enterprise', number> = {
      free: 1,
      starter: 5,
      pro: 15,
      enterprise: Number.MAX_SAFE_INTEGER
    };
    const current = await models.business.countDocuments({ owner: userId });
    const limit = planLimits[plan];
    const remaining = Math.max(0, limit - current);
    const canCreate = current < limit;

    res.status(HttpStatusCode.Ok).send({
      message: canCreate ? 'You can create a new business.' : 'Business creation limit reached for your plan.',
      data: {
        plan,
        limit,
        current,
        remaining,
        canCreate
      }
    });
    return;
  } catch (error) {
    console.error('Error checking business creation quota:', error);
    next(error);
  }
}

/**
 * @description Obtiene todos los negocios del usuario autenticado
 * @route GET /api/business
 */
export async function getBusinessesController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user?.id;

    console.log('userId: ', userId)
    
    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({ 
        success: false,
        message: 'User authentication required' 
      });
      return;
    }

    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    
    const skip = (pageNumber - 1) * limitNumber;
    
    const businesses = await models.business.find({ $or: [{ owner: userId }, { employees: userId }] })
      .populate('owner', 'firstName lastName email')
      .populate('employees', 'firstName lastName email')
      .populate('integrations')
      .skip(skip)
      .limit(limitNumber)
      .sort({ createdAt: -1 });
    
    const total = await models.business.countDocuments({ $or: [{ owner: userId }, { employees: userId }] });
    
    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Businesses retrieved successfully',
      data: {
        businesses,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(total / limitNumber),
          totalBusinesses: total,
          hasNextPage: pageNumber < Math.ceil(total / limitNumber),
          hasPrevPage: pageNumber > 1
        }
      }
    });

  } catch (error) {
    console.error('Error getting businesses:', error);
    next(error);
  }
}

/**
 * @description Obtiene un negocio por ID
 * @route GET /api/business/:id
 */
export async function getBusinessByIdController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      res.status(HttpStatusCode.BadRequest).send({ 
        success: false,
        message: 'Business ID is required' 
      });
      return;
    }

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({ 
        success: false,
        message: 'User authentication required' 
      });
      return;
    }

    const business = await models.business.findOne({ _id: id, $or: [{ owner: userId }, { employees: userId }] })
      .populate('owner', 'firstName lastName email')
      .populate('employees', 'firstName lastName email')
      .populate('integrations');
    
    if (!business) {
      res.status(HttpStatusCode.NotFound).send({ 
        success: false,
        message: 'Business not found or you do not have permission to access it' 
      });
      return;
    }

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Business retrieved successfully',
      data: business
    });

  } catch (error) {
    console.error('Error getting business:', error);
    next(error);
  }
}

/**
 * @description Actualiza un negocio por ID
 * @route PUT /api/business/:id
 */
export async function updateBusinessController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description, industry, website, phone, email, address, isActive } = req.body;
    const userId = req.user?.id;

    if (!id) {
      res.status(HttpStatusCode.BadRequest).send({ 
        success: false,
        message: 'Business ID is required' 
      });
      return;
    }

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({ 
        success: false,
        message: 'User authentication required' 
      });
      return;
    }

    // Verificar si el negocio existe y pertenece al usuario
    const existingBusiness = await models.business.findOne({ _id: id, owner: userId });
    if (!existingBusiness) {
      res.status(HttpStatusCode.NotFound).send({ 
        success: false,
        message: 'Business not found or you do not have permission to update it' 
      });
      return;
    }

    // Si se está actualizando el nombre, verificar que no exista otro negocio con ese nombre
    if (name && name !== existingBusiness.name) {
      const nameExists = await models.business.findOne({ 
        name: name.trim(), 
        owner: userId, 
        _id: { $ne: id } 
      });
      if (nameExists) {
        res.status(HttpStatusCode.Conflict).send({ 
          success: false,
          message: 'You already have another business with this name' 
        });
        return;
      }
    }

    // Validar email si se proporciona
    if (email) {
      const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      if (!emailRegex.test(email)) {
        res.status(HttpStatusCode.BadRequest).send({ 
          success: false,
          message: 'Please provide a valid email address' 
        });
        return;
      }
    }

    // Validar website si se proporciona
    if (website) {
      const websiteRegex = /^https?:\/\/.+/;
      if (!websiteRegex.test(website)) {
        res.status(HttpStatusCode.BadRequest).send({ 
          success: false,
          message: 'Please provide a valid website URL (must start with http:// or https://)' 
        });
        return;
      }
    }

    // Preparar datos de actualización
    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (industry !== undefined) updateData.industry = industry?.trim();
    if (website !== undefined) updateData.website = website?.trim();
    if (phone !== undefined) updateData.phone = phone?.trim();
    if (email !== undefined) updateData.email = email?.toLowerCase().trim();
    if (address !== undefined) updateData.address = address;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedBusiness = await models.business.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    )
    .populate('owner', 'firstName lastName email')
    .populate('employees', 'firstName lastName email')
    .populate('integrations');

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Business updated successfully',
      data: updatedBusiness
    });

  } catch (error) {
    console.error('Error updating business:', error);
    next(error);
  }
}

/**
 * @description Elimina un negocio por ID
 * @route DELETE /api/business/:id
 */
export async function deleteBusinessController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      res.status(HttpStatusCode.BadRequest).send({ 
        success: false,
        message: 'Business ID is required' 
      });
      return;
    }

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({ 
        success: false,
        message: 'User authentication required' 
      });
      return;
    }

    const deletedBusiness = await models.business.findOneAndDelete({ _id: id, owner: userId });
    
    if (!deletedBusiness) {
      res.status(HttpStatusCode.NotFound).send({ 
        success: false,
        message: 'Business not found or you do not have permission to delete it' 
      });
      return;
    }

    // Remover el negocio de la lista de negocios del usuario
    await models.user.findByIdAndUpdate(
      userId,
      { $pull: { businesses: id } },
      { new: true }
    );

    // Eliminar todas las integraciones asociadas al negocio
    await models.integration.deleteMany({ business: id });

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Business deleted successfully',
      data: {
        id: deletedBusiness._id,
        name: deletedBusiness.name,
        owner: deletedBusiness.owner
      }
    });

  } catch (error) {
    console.error('Error deleting business:', error);
    next(error);
  }
}

/**
 * @description Agrega un empleado a un negocio
 * @route POST /api/business/:id/employees
 */
export async function addEmployeeController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { employeeEmail } = req.body;
    const userId = req.user?.id;

    if (!id || !employeeEmail) {
      res.status(HttpStatusCode.BadRequest).send({ 
        success: false,
        message: 'Business ID and employee email are required' 
      });
      return;
    }

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({ 
        success: false,
        message: 'User authentication required' 
      });
      return;
    }

    // Verificar si el negocio existe y pertenece al usuario
    const business = await models.business.findOne({ _id: id, owner: userId });
    if (!business) {
      res.status(HttpStatusCode.NotFound).send({ 
        success: false,
        message: 'Business not found or you do not have permission to modify it' 
      });
      return;
    }

    // Buscar el empleado por email
    const employee = await models.user.findOne({ email: employeeEmail.toLowerCase().trim() });
    if (!employee) {
      res.status(HttpStatusCode.NotFound).send({ 
        success: false,
        message: 'User with this email not found' 
      });
      return;
    }

    // Verificar si el empleado ya está en el negocio
    if (business.employees?.some(emp => emp.toString() === (employee._id as Types.ObjectId).toString())) {
      res.status(HttpStatusCode.Conflict).send({ 
        success: false,
        message: 'This user is already an employee of this business' 
      });
      return;
    }

    // Agregar el empleado al negocio
    const updatedBusiness = await models.business.findByIdAndUpdate(
      id,
      { $push: { employees: employee._id } },
      { new: true }
    )
    .populate('owner', 'firstName lastName email')
    .populate('employees', 'firstName lastName email')
    .populate('integrations');

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Employee added successfully',
      data: updatedBusiness
    });

  } catch (error) {
    console.error('Error adding employee:', error);
    next(error);
  }
}

/**
 * @description Remueve un empleado de un negocio
 * @route DELETE /api/business/:id/employees/:employeeId
 */
export async function removeEmployeeController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, employeeId } = req.params;
    const userId = req.user?.id;

    if (!id || !employeeId) {
      res.status(HttpStatusCode.BadRequest).send({ 
        success: false,
        message: 'Business ID and employee ID are required' 
      });
      return;
    }

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({ 
        success: false,
        message: 'User authentication required' 
      });
      return;
    }

    // Verificar si el negocio existe y pertenece al usuario
    const business = await models.business.findOne({ _id: id, owner: userId });
    if (!business) {
      res.status(HttpStatusCode.NotFound).send({ 
        success: false,
        message: 'Business not found or you do not have permission to modify it' 
      });
      return;
    }

    // Verificar si el empleado está en el negocio
    if (!business.employees?.some(emp => emp.toString() === employeeId)) {
      res.status(HttpStatusCode.NotFound).send({ 
        success: false,
        message: 'Employee not found in this business' 
      });
      return;
    }

    // Remover el empleado del negocio
    const updatedBusiness = await models.business.findByIdAndUpdate(
      id,
      { $pull: { employees: employeeId } },
      { new: true }
    )
    .populate('owner', 'firstName lastName email')
    .populate('employees', 'firstName lastName email')
    .populate('integrations');

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Employee removed successfully',
      data: updatedBusiness
    });

  } catch (error) {
    console.error('Error removing employee:', error);
    next(error);
  }
}

export async function inviteTeamMemberController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { email, role = 'collaborator' } = req.body as { email?: string; role?: 'owner' | 'admin' | 'collaborator' | 'viewer' };
    const userId = req.user?.id;

    if (!id || !email) {
      res.status(HttpStatusCode.BadRequest).send({
        message: 'Business ID and invitee email are required.'
      });
      return;
    }

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: 'User authentication required.'
      });
      return;
    }

    if (!Types.ObjectId.isValid(id)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: 'Invalid business ID.'
      });
      return;
    }

    const business = await models.business.findOne({ _id: id, owner: userId });
    if (!business) {
      res.status(HttpStatusCode.NotFound).send({
        message: 'Business not found or you do not have permission to invite.'
      });
      return;
    }

    let invitee = await models.user.findOne({ email: email.toLowerCase().trim() });
    if (!invitee) {
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const generatedPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);
      const hashedPassword = await bcrypt.hash(generatedPassword, salt);
      const local = email.split('@')[0];
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      invitee = await models.user.create({
        firstName: local,
        lastName: 'Invited',
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        isVerified: false,
        verificationToken,
        verificationTokenExpires,
        businesses: []
      });
      try {
        const resendWelcome = new (await import('../services/resend.service')).default();
        await resendWelcome.sendSetupPasswordEmail(invitee.email, invitee.firstName, verificationToken);
      } catch (e) {
        console.error('Error sending account setup email:', (e as Error).message);
      }
    }

    const alreadyMember = (business.teamMembers || []).some((m: any) => `${m.user}` === `${invitee._id}` && m.status !== 'removed');
    if (alreadyMember) {
      res.status(HttpStatusCode.Conflict).send({
        message: 'User is already invited or a member of this business.'
      });
      return;
    }

    const updated = await models.business.findByIdAndUpdate(
      id,
      {
        $push: {
          teamMembers: {
            user: invitee._id,
            role,
            status: 'invited',
            invitedBy: userId,
            invitedAt: new Date()
          }
        }
      },
      { new: true }
    )
      .populate('owner', 'firstName lastName email')
      .populate('employees', 'firstName lastName email')
      .populate('integrations')
      .populate('teamMembers.user', 'firstName lastName email');

    try {
      await models.teamAudit.create({
        business: new Types.ObjectId(id),
        actor: new Types.ObjectId(userId),
        targetUser: new Types.ObjectId(`${invitee._id}`),
        action: 'invited',
        role
      });
    } catch (e) {
      console.error('Error creating audit record (invited):', (e as Error).message);
    }

    try {
      const inviter = await models.user.findById(userId).select('firstName lastName email');
      const resend = new (await import('../services/resend.service')).default();
      const acceptLink = `${process.env.FRONTEND_URL}/team/accept?businessId=${id}`;
      await resend.sendTeamInviteEmail(
        invitee.email,
        `${invitee.firstName} ${invitee.lastName}`.trim(),
        updated?.name || 'Business',
        `${inviter?.firstName || ''} ${inviter?.lastName || ''}`.trim(),
        acceptLink
      );
    } catch (e) {
      console.error('Error sending invitation email:', (e as Error).message);
    }

    res.status(HttpStatusCode.Ok).send({
      message: 'Team member invited successfully.',
      data: updated
    });
    return;
  } catch (error) {
    console.error('Error inviting team member:', error);
    next(error);
  }
}

export async function acceptTeamInviteController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      res.status(HttpStatusCode.BadRequest).send({
        message: 'Business ID is required.'
      });
      return;
    }

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: 'User authentication required.'
      });
      return;
    }

    if (!Types.ObjectId.isValid(id)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: 'Invalid business ID.'
      });
      return;
    }

    const business = await models.business.findById(id);
    if (!business) {
      res.status(HttpStatusCode.NotFound).send({
        message: 'Business not found.'
      });
      return;
    }

    const membershipIndex = (business.teamMembers || []).findIndex((m: any) => `${m.user}` === `${userId}` && m.status === 'invited');
    if (membershipIndex === -1) {
      res.status(HttpStatusCode.NotFound).send({
        message: 'No pending invitation found for this user.'
      });
      return;
    }

    business.teamMembers![membershipIndex].status = 'active';
    business.teamMembers![membershipIndex].joinedAt = new Date();

    const employeeSet = new Set((business.employees || []).map((e: any) => `${e}`));
    employeeSet.add(`${userId}`);
    business.employees = Array.from(employeeSet) as any;

    const saved = await business.save();

    const populated = await models.business
      .findById(saved._id)
      .populate('owner', 'firstName lastName email')
      .populate('employees', 'firstName lastName email')
      .populate('integrations')
      .populate('teamMembers.user', 'firstName lastName email');

    try {
      const roleAccepted = business.teamMembers![membershipIndex].role;
      await models.teamAudit.create({
        business: new Types.ObjectId(id),
        actor: new Types.ObjectId(userId),
        targetUser: new Types.ObjectId(userId),
        action: 'accepted',
        role: roleAccepted
      });
    } catch (e) {
      console.error('Error creating audit record (accepted):', (e as Error).message);
    }

    try {
      const ownerUser = await models.user.findById(business.owner).select('firstName lastName email');
      const memberUser = await models.user.findById(userId).select('firstName lastName');
      const resend = new (await import('../services/resend.service')).default();
      await resend.sendTeamAcceptedEmail(
        ownerUser?.email || '',
        `${ownerUser?.firstName || ''} ${ownerUser?.lastName || ''}`.trim(),
        `${memberUser?.firstName || ''} ${memberUser?.lastName || ''}`.trim(),
        populated?.name || 'Business',
        `${business._id}`
      );
    } catch (e) {
      console.error('Error sending invitation accepted email:', (e as Error).message);
    }

    res.status(HttpStatusCode.Ok).send({
      message: 'Team invitation accepted successfully.',
      data: populated
    });
    return;
  } catch (error) {
    console.error('Error accepting team invite:', error);
    next(error);
  }
}

export async function listTeamMembersController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      res.status(HttpStatusCode.BadRequest).send({
        message: 'Business ID is required.'
      });
      return;
    }

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: 'User authentication required.'
      });
      return;
    }

    const business = await models.business
      .findOne({ _id: id, $or: [{ owner: userId }, { employees: userId }] })
      .populate('teamMembers.user', 'firstName lastName email')
      .populate('owner', 'firstName lastName email')
      .populate('employees', 'firstName lastName email');

    if (!business) {
      res.status(HttpStatusCode.NotFound).send({
        message: 'Business not found or access denied.'
      });
      return;
    }

    res.status(HttpStatusCode.Ok).send({
      message: 'Team members retrieved successfully.',
      data: business.teamMembers || []
    });
    return;
  } catch (error) {
    console.error('Error listing team members:', error);
    next(error);
  }
}

export async function updateTeamMemberRoleController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, userId: memberUserId } = req.params as { id: string; userId: string };
    const { role } = req.body as { role?: 'owner' | 'admin' | 'collaborator' | 'viewer' };
    const requesterId = req.user?.id;

    if (!id || !memberUserId || !role) {
      res.status(HttpStatusCode.BadRequest).send({
        message: 'Business ID, userId and role are required.'
      });
      return;
    }

    if (!requesterId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: 'User authentication required.'
      });
      return;
    }

    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(memberUserId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: 'Invalid business ID or user ID.'
      });
      return;
    }

    const business = await models.business.findOne({ _id: id, owner: requesterId });
    if (!business) {
      res.status(HttpStatusCode.Forbidden).send({
        message: 'Only the business owner can change member roles.'
      });
      return;
    }

    const idx = (business.teamMembers || []).findIndex((m: any) => `${m.user}` === `${memberUserId}` && m.status !== 'removed');
    if (idx === -1) {
      res.status(HttpStatusCode.NotFound).send({
        message: 'Team member not found.'
      });
      return;
    }

    business.teamMembers![idx].role = role;
    const saved = await business.save();

    const populated = await models.business
      .findById(saved._id)
      .populate('teamMembers.user', 'firstName lastName email')
      .populate('owner', 'firstName lastName email')
      .populate('employees', 'firstName lastName email');

    try {
      await models.teamAudit.create({
        business: new Types.ObjectId(id),
        actor: new Types.ObjectId(requesterId),
        targetUser: new Types.ObjectId(memberUserId),
        action: 'role_updated',
        role
      });
    } catch (e) {
      console.error('Error creating audit record (role_updated):', (e as Error).message);
    }

    try {
      await models.teamAudit.create({
        business: new Types.ObjectId(id),
        actor: new Types.ObjectId(requesterId),
        targetUser: new Types.ObjectId(memberUserId),
        action: 'revoked'
      });
    } catch (e) {
      console.error('Error creating audit record (revoked):', (e as Error).message);
    }

    try {
      const member = await models.user.findById(memberUserId).select('firstName lastName email');
      const resend = new (await import('../services/resend.service')).default();
      await resend.sendTeamRoleUpdatedEmail(
        member?.email || '',
        `${member?.firstName || ''} ${member?.lastName || ''}`.trim(),
        populated?.name || 'Business',
        role
      );
    } catch (e) {
      console.error('Error sending role updated email:', (e as Error).message);
    }

    res.status(HttpStatusCode.Ok).send({
      message: 'Team member role updated successfully.',
      data: populated
    });
    return;
  } catch (error) {
    console.error('Error updating team member role:', error);
    next(error);
  }
}

export async function revokeTeamMemberController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, userId: memberUserId } = req.params as { id: string; userId: string };
    const requesterId = req.user?.id;

    if (!id || !memberUserId) {
      res.status(HttpStatusCode.BadRequest).send({
        message: 'Business ID and userId are required.'
      });
      return;
    }

    if (!requesterId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: 'User authentication required.'
      });
      return;
    }

    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(memberUserId)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: 'Invalid business ID or user ID.'
      });
      return;
    }

    const business = await models.business.findOne({ _id: id, owner: requesterId });
    if (!business) {
      res.status(HttpStatusCode.Forbidden).send({
        message: 'Only the business owner can revoke invitations or memberships.'
      });
      return;
    }

    const idx = (business.teamMembers || []).findIndex((m: any) => `${m.user}` === `${memberUserId}`);
    if (idx === -1) {
      res.status(HttpStatusCode.NotFound).send({
        message: 'Team member not found or already removed.'
      });
      return;
    }
    await models.business.updateOne(
      { _id: id },
      { $pull: { teamMembers: { user: new Types.ObjectId(memberUserId) }, employees: new Types.ObjectId(memberUserId) } }
    );

    await models.user.updateOne(
      { _id: memberUserId },
      { $pull: { businesses: new Types.ObjectId(id) } }
    );

    const populated = await models.business
      .findById(id)
      .populate('teamMembers.user', 'firstName lastName email')
      .populate('owner', 'firstName lastName email')
      .populate('employees', 'firstName lastName email');

    try {
      await models.teamAudit.create({
        business: new Types.ObjectId(id),
        actor: new Types.ObjectId(requesterId),
        targetUser: new Types.ObjectId(memberUserId),
        action: 'revoked'
      });
    } catch (e) {
      console.error('Error creating audit record (revoked):', (e as Error).message);
    }

    try {
      const member = await models.user.findById(memberUserId).select('firstName lastName email');
      const resend = new (await import('../services/resend.service')).default();
      await resend.sendTeamRevokedEmail(
        member?.email || '',
        `${member?.firstName || ''} ${member?.lastName || ''}`.trim(),
        populated?.name || 'Business'
      );
    } catch (e) {
      console.error('Error sending revoked email:', (e as Error).message);
    }

    res.status(HttpStatusCode.Ok).send({
      message: 'Team member revoked successfully.',
      data: populated
    });
    return;
  } catch (error) {
    console.error('Error revoking team member:', error);
    next(error);
  }
}

export async function listPendingInvitationsForUserController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    const { page = '1', limit = '20', sort = 'desc' } = req.query as Record<string, string>;

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: 'User authentication required.'
      });
      return;
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const sortOrder = (String(sort).toLowerCase() === 'asc') ? 1 : -1;

    const match = { 'teamMembers': { $elemMatch: { user: new Types.ObjectId(userId), status: 'invited' } } } as any;
    const total = await models.business.countDocuments(match);

    const businesses = await models.business
      .find(match)
      .sort({ 'teamMembers.invitedAt': sortOrder })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .select('name teamMembers')
      .populate({ path: 'teamMembers.user', select: 'firstName lastName email' })
      .populate({ path: 'teamMembers.invitedBy', select: 'firstName lastName email' });

    const invitations = [] as Array<{ businessId: string; businessName: string; role: string; status: string; invitedAt?: Date; invitedBy?: { id: string; name: string; email: string } }>;
    for (const b of businesses) {
      const tm = (b.teamMembers || []).find((m: any) => `${m.user?._id || m.user}` === `${userId}` && m.status === 'invited');
      if (!tm) continue;
      const inviter = tm.invitedBy as any;
      const inviterInfo = inviter ? { id: `${inviter._id}`, name: `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim(), email: inviter.email } : undefined;
      invitations.push({ businessId: `${b._id}`, businessName: (b as any).name, role: tm.role, status: tm.status, invitedAt: tm.invitedAt, invitedBy: inviterInfo });
    }

    res.status(HttpStatusCode.Ok).send({
      message: 'Pending team invitations retrieved successfully.',
      data: {
        invitations,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages: Math.ceil(total / limitNumber)
        }
      }
    });
    return;
  } catch (error) {
    console.error('Error listing pending invitations:', error);
    next(error);
  }
}
export async function listTeamAuditController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user?.id;

    if (!id) {
      res.status(HttpStatusCode.BadRequest).send({
        message: 'Business ID is required.'
      });
      return;
    }

    if (!userId) {
      res.status(HttpStatusCode.Unauthorized).send({
        message: 'User authentication required.'
      });
      return;
    }

    if (!Types.ObjectId.isValid(id)) {
      res.status(HttpStatusCode.BadRequest).send({
        message: 'Invalid business ID.'
      });
      return;
    }

    const business = await models.business.findOne({ _id: id, $or: [{ owner: userId }, { employees: userId }] });
    if (!business) {
      res.status(HttpStatusCode.Forbidden).send({
        message: 'Access denied.'
      });
      return;
    }

    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    const events = await models.teamAudit.find({ business: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .populate('actor', 'firstName lastName email')
      .populate('targetUser', 'firstName lastName email');

    const total = await models.teamAudit.countDocuments({ business: id });

    res.status(HttpStatusCode.Ok).send({
      message: 'Team audit retrieved successfully.',
      data: {
        events,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(total / limitNumber),
          totalEvents: total,
          hasNextPage: pageNumber < Math.ceil(total / limitNumber),
          hasPrevPage: pageNumber > 1
        }
      }
    });
    return;
  } catch (error) {
    console.error('Error listing team audit:', error);
    next(error);
  }
}