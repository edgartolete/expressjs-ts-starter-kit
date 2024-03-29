import { Request, Response } from 'express';
import { JsonResponse } from '../Utils/responseTemplate';
import { sysAdminModel } from '../Models/sysAdminModel';
import { secure } from '../Utils/secure';
import { tryCatchAsync } from '../Utils/helpers';
import { redisClient } from '../Connections/redis';

export const sysAdminController = {
	authenticate: async (req: Request, res: Response) => {
		const { username = null, password = null } = req.body;

		if (username == null || password == null) {
			return JsonResponse.incompleteData(res);
		}

		/** get all the system administrators */
		const [result, error] = await tryCatchAsync(() => sysAdminModel.get());

		if (error !== null) return JsonResponse.failed(res, error);

		/** if the there is no entry then return.  */
		if (result.length == 0) {
			return JsonResponse.nothingAffected(res, 'No recorded system administrator.');
		}

		/** for each user, check if username and password match */
		for (const user of result) {
			const usernameMatched = await secure.compare(username, user.username);
			const passwordMatched = await secure.compare(password, user.password);

			if (usernameMatched && passwordMatched) {
				/** if found, hash the username and password to create a pbkdf */
				const hash = await secure.hash(username + password);
				const salt = secure.salt(64);

				/** store the user id for updating purpose */

				const [pbkdfResult, pbkdfError] = await tryCatchAsync(() => secure.generatePBKDF2Key(hash, salt));

				if (pbkdfError != null || pbkdfResult == null) {
					return JsonResponse.failed(res, pbkdfError);
				}

				/** if successfully hashed, cache the derived key and the the hashed (username + password) */
				redisClient.setEx(`${user.id}-pbkdf`, 300, pbkdfResult.key);

				/** you will have 120 seconds to be use the token, if you remain active, expiration will extend */
				redisClient.setEx(`${user.id}-hash`, 300, hash);

				/** use the 64byte generated salt as the token */
				return JsonResponse.success(res, {
					userId: user.id,
					token: salt
				});
			}
		}

		/** if user input did not match any of the user, return. */
		return JsonResponse.failed(res, 'Username or Password is incorrect.');
	},
	updateUsername: async (req: Request, res: Response) => {
		const userId = parseInt(req.headers['user-id']?.toString()!);

		const { username = null } = req.body;

		if (username == null) {
			return JsonResponse.incompleteData(res, null, 'Required username from body.');
		}

		const usernameHashed = await secure.hash(username);

		const [result, err] = await tryCatchAsync(() => sysAdminModel.updateUserName(userId, usernameHashed));

		if (err !== null) {
			return JsonResponse.failed(res, err);
		}

		return JsonResponse.success(res, result);
	},
	updatePassword: async (req: Request, res: Response) => {
		const userId = parseInt(req.headers['user-id']?.toString()!);

		const { password = null } = req.body;

		if (password == null) {
			return JsonResponse.incompleteData(res, null, 'Required password from body.');
		}

		const passwordHashed = await secure.hash(password);

		const [result, err] = await tryCatchAsync(() => sysAdminModel.updatePassword(userId, passwordHashed));

		if (err !== null) {
			return JsonResponse.failed(res, err);
		}

		return JsonResponse.success(res, result);
	},
	logout: async (req: Request, res: Response) => {
		const userId = parseInt(req.headers['user-id']?.toString()!);

		const pbkdfDel = await redisClient.del(`${userId}-pbkdf`);
		const hashDel = await redisClient.del(`${userId}-hash`);

		if (pbkdfDel !== 1 && hashDel !== 1) {
			return JsonResponse.nothingAffected(res, null, 'You are not logged-in.');
		}
		return JsonResponse.success(res, null, 'You are not successfully logged-out.');
	}
};
