import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import models from '../models';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { HttpStatusCode } from 'axios';
import ResendEmail from '../services/resend.service';

/**
 * @description Creates a new admin user with generated password
 * @route POST /api/auth/create-admin
 */
export async function createAdminController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, firstName, lastName } = req.body;

    // 1. Basic input validation
    if (!email || !firstName || !lastName) {
      res.status(HttpStatusCode.BadRequest).send({ 
        success: false,
        message: 'Email, firstName, and lastName are required' 
      });
      return;
    }

    // 2. Check if user already exists
    const existingUser = await models.user.findOne({ email });
    if (existingUser) {
      res.status(HttpStatusCode.Conflict).send({ 
        success: false,
        message: 'User with this email already exists' 
      });
      return;
    }

    // 3. Generate secure random password
    const generatedPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);
    
    // 4. Hash the generated password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(generatedPassword, salt);

    // 5. Create new admin user in database
    const newAdmin = await models.user.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: 'admin',
      isVerified: true // Admin accounts are pre-verified
    });

    // 7. Prepare response
    const adminResponse = {
      id: newAdmin._id,
      firstName: newAdmin.firstName,
      lastName: newAdmin.lastName,
      email: newAdmin.email,
      role: newAdmin.role,
      isVerified: newAdmin.isVerified,
      createdAt: newAdmin.createdAt,
      generatedPassword // Include the generated password in response
    };

    res.status(HttpStatusCode.Created).send({
      success: true,
      message: 'Admin account created successfully',
      admin: adminResponse
    });
    return;

  } catch (error) {
    console.error('Error creating admin account:', error);
    next(error);
  }
}
/**
 * @description Registra un nuevo usuario en la base de datos.
 * @route POST /api/auth/register
 */
export async function registerUserController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { firstName, lastName, email, password } = req.body;

    // 1. Validación de entrada básica
    if (!firstName || !lastName || !email || !password) {
      res.status(400).send({ message: 'All fields are required' });
      return
    }

    // 2. Verificar si el usuario ya existe
    const existingUser = await models.user.findOne({ email });
    if (existingUser) {
      // Usamos el código 409 Conflict que es más específico para este caso
      res.status(409).send({ message: 'This user already exists' });
      return
    }

    // 3. Hashear la contraseña (¡NUNCA GUARDAR EN TEXTO PLANO!)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // 5. Crear la nueva instancia del usuario
    const newUser = new models.user({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      verificationToken,
      verificationTokenExpires,
      isVerified: false
    });

    // 6. Guardar el usuario en la base de datos
    await newUser.save();

    // 7. Send welcome verification email
    try {
      const resendService = new ResendEmail();
      await resendService.sendWelcomeVerificationEmail(
        newUser.email,
        newUser.firstName,
        verificationToken
      );
    } catch (emailError) {
      console.error('Error sending welcome verification email:', emailError);
      // Don't fail user registration if email fails
    }

    // 8. Preparar la respuesta al cliente
    // Por seguridad, no devolvemos la contraseña hasheada ni el token de verificación
    const userResponse = {
      id: newUser._id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      role: newUser.role,
      isVerified: newUser.isVerified,
      createdAt: newUser.createdAt
    };

    res.status(HttpStatusCode.Created).send({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      user: userResponse
    });

    return
  } catch (error) {
    console.error('Error en el controlador de registro:', error);
    // Pasamos el error al manejador de errores de Express
    next(error); 
  }
}

export async function loginUserController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(HttpStatusCode.BadRequest).send({ 
        success: false,
        message: 'Email and password are required' 
      });
      return;
    }

    // 1. Buscar al usuario y traer explícitamente la contraseña
    const user = await models.user.findOne({ email }).select('+password');
    if (!user) {
      res.status(HttpStatusCode.NotFound).send({ 
        success: false,
        message: 'User not found' 
      });
      return;
    }

    // 2. Check if user is verified
    if (!user.isVerified) {
      res.status(HttpStatusCode.Forbidden).send({ 
        success: false,
        message: 'Please verify your email before logging in' 
      });
      return;
    }

    // 3. Comparar la contraseña enviada con la hasheada en la BBDD
    const isMatch = bcrypt.compareSync(password, user.password!);

    if (!isMatch) {
      res.status(HttpStatusCode.Unauthorized).send({ 
        success: false,
        message: 'Invalid credentials' 
      });
      return;
    }

    // 4. Crear el Payload para el token
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
    };

    // 5. Firmar el token
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'SUPER_SECRET_KEY', {
      expiresIn: '1d', // El token expirará en 1 día
    });

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Login successful',
      token: `Bearer ${token}`,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });


  } catch (error: unknown) {
    console.error('error login user', error)
    next(error)
  }
}

/**
 * @description Verifies a user's email address using verification token
 * @route GET /api/auth/verify/:token
 */
export async function verifyUserController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(HttpStatusCode.BadRequest).send({ 
        success: false,
        message: 'Verification token is required' 
      });
      return;
    }

    // 1. Find user with the verification token and check if it's not expired
    const user = await models.user.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() }
    }).select('+verificationToken +verificationTokenExpires');

    if (!user) {
      res.status(HttpStatusCode.BadRequest).send({ 
        success: false,
        message: 'Invalid or expired verification token' 
      });
      return;
    }

    // 2. Check if user is already verified
    if (user.isVerified) {
      res.status(HttpStatusCode.Ok).send({ 
        success: true,
        message: 'User is already verified' 
      });
      return;
    }

    // 3. Update user verification status
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Email verified successfully. You can now login to your account.',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error('Error verifying user:', error);
    next(error);
  }
}

/**
 * @description Sets a user's password using a verification token and verifies the account
 * @route POST /api/auth/set-password
 */
export async function setPasswordWithTokenController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password) {
      res.status(HttpStatusCode.BadRequest).send({
        message: 'Verification token and new password are required.'
      });
      return;
    }

    const user = await models.user
      .findOne({ verificationToken: token, verificationTokenExpires: { $gt: new Date() } })
      .select('+verificationToken +verificationTokenExpires');

    if (!user) {
      res.status(HttpStatusCode.BadRequest).send({
        message: 'Invalid or expired verification token.'
      });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user.password = hashedPassword;
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.status(HttpStatusCode.Ok).send({
      message: 'Password set successfully. Your account is verified.',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isVerified: user.isVerified
      }
    });
    return;
  } catch (error) {
    console.error('Error setting password:', error);
    next(error);
  }
}