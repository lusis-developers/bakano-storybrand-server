import type { Request, Response, NextFunction } from 'express';
import { HttpStatusCode } from 'axios';
import bcrypt from 'bcryptjs';
import models from '../models';

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