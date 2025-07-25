import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import models from '../models';
import jwt from 'jsonwebtoken';
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

    // 4. Crear la nueva instancia del usuario
    const newUser = new models.user({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      // El rol por defecto es 'client' según nuestro modelo
    });

    // 5. Guardar el usuario en la base de datos
    await newUser.save();

    // 6. Preparar la respuesta al cliente
    // Por seguridad, no devolvemos la contraseña hasheada.
    // Aunque en el modelo pusimos 'select: false', es una buena práctica asegurarlo aquí también.
    const userResponse = newUser.toObject();
    delete userResponse.password;

    // Usamos el código 201 Created, que es el estándar para creación exitosa de un recurso
    res.status(201).send({
      message: 'User registered succesfully.',
      user: userResponse,
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
      res.status(400).send({ message: 'Email and password are required' });
      return;
    }

    // 1. Buscar al usuario y traer explícitamente la contraseña
    const user = await models.user.findOne({ email }).select('+password');
    if (!user) {
      res.status(404).send({ message: 'User not found' });
      return;
    }

    // 2. Comparar la contraseña enviada con la hasheada en la BBDD
    const isMatch = bcrypt.compareSync(password, user.password!);

    if (!isMatch) {
      res.status(401).send({ message: 'Invalid credentials' }); // Unauthorized
      return;
    }

    // 3. Crear el Payload para el token
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
    };

    // 4. Firmar el token
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'SUPER_SECRET_KEY', {
      expiresIn: '1d', // El token expirará en 1 día
    });

    res.status(200).send({
      message: 'Login successful',
      token: `Bearer ${token}`, // Se envía el token al cliente
    });


  } catch (error: unknown) {
    console.error('error login user', error)
    next(error)
  }
}