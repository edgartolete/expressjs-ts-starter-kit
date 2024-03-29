import { Request, Response, NextFunction } from 'express';
import { mode } from '../config';
import { JsonResponse } from '../Utils/responseTemplate';
import { App } from '../Entities/appsEntity';
import { secure } from '../Utils/secure';

/**
 *  This middleware checks for param :app and x-api-key. Validate that application is valid.
 */
export async function appCodeMiddleware(req: Request, res: Response, next: NextFunction) {
	const { app: appCode = null } = req.params;
	const apiKey = req.headers['x-api-key'];

	if (appCode === null) {
		return JsonResponse.failed(res, 'No application selected.');
	}

	if (apiKey == null) {
		return JsonResponse.failed(res, 'No API Key provided.');
	}

	if (Array.isArray(apiKey)) {
		return JsonResponse.failed(res, 'API Key received was an array.');
	}

	const result = await App.findOneBy({ code: appCode });

	if (result == null) {
		return JsonResponse.failed(res, 'App code is incorrect.');
	}

	const success = await secure.compare(apiKey, result.apiKey);

	if (!success) {
		return JsonResponse.failed(res, 'API Key is incorrect.');
	}

	req.headers['access-token-secret'] = result.accessTokenSecret;
	req.headers['refresh-token-secret'] = result.refreshTokenSecret;

	next();
}
