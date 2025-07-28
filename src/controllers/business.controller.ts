import type { Response, NextFunction } from 'express';
import { HttpStatusCode } from 'axios';
import { Types } from 'mongoose';
import models from '../models';
import type { AuthRequest } from '../types/AuthRequest';

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

/**
 * @description Obtiene todos los negocios del usuario autenticado
 * @route GET /api/business
 */
export async function getBusinessesController(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user?.id;
    
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
    
    const businesses = await models.business.find({ owner: userId })
      .populate('owner', 'firstName lastName email')
      .populate('employees', 'firstName lastName email')
      .populate('integrations')
      .skip(skip)
      .limit(limitNumber)
      .sort({ createdAt: -1 });
    
    const total = await models.business.countDocuments({ owner: userId });
    
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

    const business = await models.business.findOne({ _id: id, owner: userId })
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