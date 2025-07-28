import type { Request, Response, NextFunction } from 'express';
import { HttpStatusCode } from 'axios';
import models from '../models';
import ResendEmail from '../services/resend.service';
import crypto from 'crypto';

/**
 * @description Crea un nuevo usuario en la base de datos
 * @route POST /api/user
 */
export async function createUserController(req: Request, res: Response, next: NextFunction): Promise<void> {
   try {
    const { firstName, lastName, email, password, birthDate } = req.body;

    // 1. Validación de entrada básica
    if (!firstName || !lastName || !email || !password) {
      res.status(HttpStatusCode.BadRequest).send({ 
        success: false,
        message: 'All fields are required: firstName, lastName, email, password' 
      });
      return;
    }

    // 2. Verificar si el usuario ya existe
    const existingUser = await models.user.findOne({ email });
    if (existingUser) {
      res.status(HttpStatusCode.Conflict).send({ 
        success: false,
        message: 'User with this email already exists' 
      });
      return;
    }

    // 3. Validar formato de fecha si se proporciona
    let birthDateObj;
    if (birthDate) {
      birthDateObj = new Date(birthDate);
      if (isNaN(birthDateObj.getTime()) || birthDateObj >= new Date()) {
        res.status(HttpStatusCode.BadRequest).send({ 
          success: false,
          message: 'Birth date must be valid and before current date' 
        });
        return;
      }
    }

    // 4. Hash password
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5. Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // 6. Crear la nueva instancia del usuario
    const newUser = new models.user({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      birthDate: birthDateObj,
      businesses: [],
      isVerified: false,
      verificationToken,
      verificationTokenExpires
    });

    // 7. Guardar el usuario en la base de datos
    const savedUser = await newUser.save();

    // 8. Send welcome verification email
    try {
      const resendService = new ResendEmail();
      await resendService.sendWelcomeVerificationEmail(
        savedUser.email,
        savedUser.firstName,
        verificationToken
      );
    } catch (emailError) {
      console.error('Error sending welcome verification email:', emailError);
      // Don't fail user creation if email fails
    }

    // 9. Preparar la respuesta al cliente
    const userResponse = {
      id: savedUser._id,
      firstName: savedUser.firstName,
      lastName: savedUser.lastName,
      email: savedUser.email,
      birthDate: savedUser.birthDate,
      role: savedUser.role,
      isVerified: savedUser.isVerified,
      fullName: `${savedUser.firstName} ${savedUser.lastName}`,
      businesses: savedUser.businesses,
      createdAt: savedUser.createdAt
    };

    res.status(HttpStatusCode.Created).send({
      success: true,
      message: 'User created successfully. Please check your email to verify your account.',
      data: userResponse
    });

  } catch (error) {
    console.error('Error getting delivery quote:', error);
    next(error);
  }
}

/**
 * @description Obtiene todos los usuarios
 * @route GET /api/users
 */
export async function getUsersController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    
    const skip = (pageNumber - 1) * limitNumber;
    
    const users = await models.user.find()
      .select('-password')
      .populate('businesses')
      .skip(skip)
      .limit(limitNumber)
      .sort({ createdAt: -1 });
    
    const total = await models.user.countDocuments();
    
    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(total / limitNumber),
          totalUsers: total,
          hasNextPage: pageNumber < Math.ceil(total / limitNumber),
          hasPrevPage: pageNumber > 1
        }
      }
    });

  } catch (error) {
    console.error('Error getting delivery quote:', error);
    next(error);
  }
}

/**
 * @description Obtiene un usuario por ID
 * @route GET /api/user/:id
 */
export async function getUserByIdController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(HttpStatusCode.BadRequest).send({ 
        success: false,
        message: 'User ID is required' 
      });
      return;
    }

    const user = await models.user.findById(id)
      .select('-password')
      .populate('businesses');
    
    if (!user) {
      res.status(HttpStatusCode.NotFound).send({ 
        success: false,
        message: 'User not found' 
      });
      return;
    }

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'User retrieved successfully',
      data: user
    });

  } catch (error) {
    console.error('Error getting delivery quote:', error);
    next(error);
  }
}

/**
 * @description Actualiza un usuario por ID
 * @route PUT /api/user/:id
 */
export async function updateUserController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, birthDate } = req.body;

    if (!id) {
      res.status(HttpStatusCode.BadRequest).send({ 
        success: false,
        message: 'User ID is required' 
      });
      return;
    }

    // Verificar si el usuario existe
    const existingUser = await models.user.findById(id);
    if (!existingUser) {
      res.status(HttpStatusCode.NotFound).send({ 
        success: false,
        message: 'User not found' 
      });
      return;
    }

    // Si se está actualizando el email, verificar que no exista otro usuario con ese email
    if (email && email !== existingUser.email) {
      const emailExists = await models.user.findOne({ email, _id: { $ne: id } });
      if (emailExists) {
        res.status(HttpStatusCode.Conflict).send({ 
          success: false,
          message: 'Another user with this email already exists' 
        });
        return;
      }
    }

    // Preparar datos de actualización
    const updateData: any = {};
    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (birthDate) {
      const birthDateObj = new Date(birthDate);
      if (isNaN(birthDateObj.getTime()) || birthDateObj >= new Date()) {
        res.status(HttpStatusCode.BadRequest).send({ 
          success: false,
          message: 'Birth date must be valid and before current date' 
        });
        return;
      }
      updateData.birthDate = birthDateObj;
    }

    const updatedUser = await models.user.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    ).populate('businesses').select('-password');

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });

  } catch (error) {
    console.error('Error getting delivery quote:', error);
    next(error);
  }
}

/**
 * @description Elimina un usuario por ID
 * @route DELETE /api/user/:id
 */
export async function deleteUserController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(HttpStatusCode.BadRequest).send({ 
        success: false,
        message: 'User ID is required' 
      });
      return;
    }

    const deletedUser = await models.user.findByIdAndDelete(id);
    
    if (!deletedUser) {
      res.status(HttpStatusCode.NotFound).send({ 
        success: false,
        message: 'User not found' 
      });
      return;
    }

    res.status(HttpStatusCode.Ok).send({
      success: true,
      message: 'User deleted successfully',
      data: {
        id: deletedUser._id,
        firstName: deletedUser.firstName,
        lastName: deletedUser.lastName,
        email: deletedUser.email
      }
    });

  } catch (error) {
    console.error('Error getting delivery quote:', error);
    next(error);
  }
}