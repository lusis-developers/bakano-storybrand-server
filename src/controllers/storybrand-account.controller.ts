import type { Request, Response, NextFunction } from 'express';
import { HttpStatusCode } from 'axios';
import bcrypt from 'bcryptjs';
import models from '../models';
import { Types } from 'mongoose';

/**
 * @description Creates a new user account (already verified)
 * @route POST /api/storybrand-account
 */
export async function createStorybrandAccountController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, firstName, lastName } = req.body;

    // 1. Basic input validation
    if (!email || !password || password.length < 6) {
      res.status(HttpStatusCode.BadRequest).send({ 
        message: 'Email and password are required. Password must be at least 6 characters long' 
      });
      return;
    }
    
    // Use default values if firstName or lastName are not provided
    const userFirstName = firstName || email.split('@')[0];
    const userLastName = lastName || '';

    // 2. Check if user already exists
    const existingUser = await models.user.findOne({ email });
    if (existingUser) {
      // Using 409 Conflict which is more specific for this case
      res.status(HttpStatusCode.Conflict).send({ 
        message: 'User with this email already exists' 
      });
      return;
    }

    // 3. Hash the password (NEVER STORE IN PLAIN TEXT!)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create new user instance (already verified)
    const newUser = new models.user({
      email,
      password: hashedPassword,
      firstName: userFirstName,
      lastName: userLastName,
      isVerified: true,
      role: 'client'
    });

    // 5. Save user to database
    await newUser.save();

    // 6. Prepare response to client
    // For security, we don't return the hashed password
    const userResponse = {
      _id: newUser._id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      role: newUser.role,
      isVerified: newUser.isVerified,
      createdAt: newUser.createdAt
    };

    res.status(HttpStatusCode.Created).send({
      message: 'User account created and verified successfully',
      user: userResponse
    });
    return;

  } catch (error) {
    console.error('Error creating user account:', error);
    // Pass the error to Express error handler
    next(error);
  }
}

/**
 * @description Admin endpoint to change a user's password
 * @route PUT /api/storybrand-account/password
 */
export async function adminChangePasswordController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, newPassword } = req.body;

    // 1. Basic input validation
    if (!userId || !newPassword || newPassword.length < 6) {
      res.status(HttpStatusCode.BadRequest).send({ 
        message: 'User ID and new password are required. New password must be at least 6 characters long' 
      });
      return;
    }

    // Validate userId format
    if (!Types.ObjectId.isValid(userId)) {
      res.status(HttpStatusCode.BadRequest).send({ 
        message: 'Invalid user ID format' 
      });
      return;
    }

    // 2. Find the user
    const user = await models.user.findById(userId);
    if (!user) {
      res.status(HttpStatusCode.NotFound).send({ 
        message: 'User not found' 
      });
      return;
    }

    // 3. Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 4. Update the password
    user.password = hashedPassword;
    await user.save();

    res.status(HttpStatusCode.Ok).send({
      message: 'Password changed successfully'
    });
    return;

  } catch (error) {
    console.error('Error changing password:', error);
    next(error);
  }
}

/**
 * @description Admin endpoint to delete a user account and all associated data
 * @route DELETE /api/storybrand-account/:userId
 */
export async function adminDeleteUserAccountController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;

    // 1. Basic input validation
    if (!userId) {
      res.status(HttpStatusCode.BadRequest).send({ 
        message: 'User ID is required' 
      });
      return;
    }

    // Validate userId format
    if (!Types.ObjectId.isValid(userId)) {
      res.status(HttpStatusCode.BadRequest).send({ 
        message: 'Invalid user ID format' 
      });
      return;
    }

    // 2. Find the user
    const user = await models.user.findById(userId);
    if (!user) {
      res.status(HttpStatusCode.NotFound).send({ 
        message: 'User not found' 
      });
      return;
    }

    // 3. Delete all associated data
    // This is where you would delete all data associated with the user
    // For example, delete all brandscripts, businesses, content, etc.
    // You can use Promise.all to run these operations in parallel
    await Promise.all([
      // Delete brandscripts
      models.brandscript.deleteMany({ userId: userId }),
      // Delete businesses
      models.business.deleteMany({ userId: userId }),
      // Delete content
      models.content.deleteMany({ userId: userId }),
      // Delete onboarding
      models.onboarding.deleteMany({ userId: userId }),
      // Delete integrations
      models.integration.deleteMany({ userId: userId }),
      // Finally delete the user
      models.user.findByIdAndDelete(userId)
    ]);

    res.status(HttpStatusCode.Ok).send({
      message: 'User account and all associated data deleted successfully'
    });
    return;

  } catch (error) {
    console.error('Error deleting user account:', error);
    next(error);
  }
}