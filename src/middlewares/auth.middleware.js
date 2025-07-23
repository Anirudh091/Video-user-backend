import APIerror from '../utils/APIerror.js';
import asyncHandler from '../utils/asyncHandler.js';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';

export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.headers?.('Authorization')?.replace('Bearer', '');
    if (!token) {
      throw new APIerror(401, 'Unauthorized access');
    }

    const decodedToken = await jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id).select(
      '-password -refreshToken'
    );
    if (!user) {
      throw new APIerror(404, 'User not found');
    }
    req.user = user;
    next();
  } catch (error) {
    throw new APIerror(401, error?.message || 'Invalid or expired token');
  }
});
