import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import models from "../../models";

export async function getIntegrationsController(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const { businessId } = req.params;
		if (!businessId || !Types.ObjectId.isValid(businessId)) {
			return res.status(400).send({ message: "businessId inválido" });
		}

		const integrations = await models.integration
			.find({ business: businessId })
			.sort({ createdAt: -1 });
		return res
			.status(200)
			.send({ count: integrations.length, data: integrations });
	} catch (error) {
		console.error("Error al obtener integraciones:", error);
		next(error);
	}
}
