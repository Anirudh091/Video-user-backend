import asyncHandler from '../utils/asyncHandler.js';
import APIerror from '../utils/APIerror.js';
import { User } from '../models/user.model.js';
import { cloudinaryUploader } from '../utils/cloudinary.js';
import APIresponse from '../utils/APIresponse.js';
import jwt, { decode } from 'jsonwebtoken';
import mongoose from 'mongoose';

const generateAccessAndRefreshTokens = async userId => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new APIerror(500, 'Token generation failed');
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // 1. Get the user data from frontend
  // 2. Validate the user data
  // 3. Check if the user already exists
  // 4. Check for images, and avatar
  // Upload the images to cloudinary
  // create user object -  create entry in database
  // remove password and refresh token from user object
  // check for use creation
  // return response
  const { fullName, username, lastName, email, password } = req.body;

  if (
    [fullName, username, lastName, email, password].some(
      field => field.trim() === ''
    )
  ) {
    throw new APIerror(400, 'All fields are required');
  }

  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    throw new APIerror(409, 'User already exists');
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new APIerror(400, 'Avatar is required');
  }

  const avatar = await cloudinaryUploader(avatarLocalPath);
  const coverImage = coverImageLocalPath
    ? await cloudinaryUploader(coverImageLocalPath)
    : null;

  if (!avatar) {
    throw new APIerror(400, 'Avatar is required');
  }

  const user = await User.create({
    fullName,
    lastName,
    avatar: avatar.url,
    coverImage: coverImage?.url || '',
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    '-password -refreshToken'
  );

  if (!createdUser) {
    throw new APIerror(500, 'User creation failed');
  }

  return res
    .status(201)
    .json(new APIresponse(201, createdUser, 'User created successfully'));
});

const loginUser = asyncHandler(async (req, res) => {
  // req body -> data
  // username or email
  // find the user
  // user not found or check password if user found
  // access token and refresh token generate
  // send secure cookies
  // return response

  const { email, username, password } = req.body;
  if (!email && !username) {
    throw new APIerror(400, 'username and Email are required');
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });
  if (!user) {
    throw new APIerror(404, 'User does not exist');
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new APIerror(401, 'Invalid user credentials');
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    '-password -refreshToken'
  );
  if (!loggedInUser) {
    throw new APIerror(500, 'Login failed');
  }

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
      new APIresponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        'User logged in successfully'
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new APIresponse(200, {}, 'User logged out successfully'));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new APIerror(401, 'Unauthorized access');
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken._id);
    if (!user || user.refreshToken !== incomingRefreshToken) {
      throw new APIerror(401, 'Invalid or expired refresh token');
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);
    return res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', newRefreshToken, options)
      .json(
        new APIresponse(
          200,
          { accessToken, newRefreshToken },
          'Tokens refreshed successfully'
        )
      );
  } catch (error) {
    throw new APIerror(
      401,
      error?.message || 'Invalid or expired refresh token'
    );
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new APIerror(401, 'Old password is incorrect');
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new APIresponse(200, {}, 'Password changed successfully'));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new APIresponse(200, req.user, 'current user fetched successfully'));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, lastName, username, email } = req.body;
  if (!fullName || !email) {
    throw new APIerror(400, 'All fields are required');
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true, runValidators: true }
  ).select('-password -refreshToken');

  return res
    .status(200)
    .json(new APIresponse(200, user, 'User updated successfully'));
});

const updateAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new APIerror(400, 'Avatar is required');
  }

  // Get the current user to access the old avatar URL
  const currentUser = await User.findById(req.user._id);
  if (!currentUser) {
    throw new APIerror(404, 'User not found');
  }

  const avatar = await cloudinaryUploader(avatarLocalPath);
  if (!avatar.url) {
    throw new APIerror(400, 'Error uploading avatar');
  }

  // Update user with new avatar
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select('-password -refreshToken');

  // Delete the old avatar from Cloudinary (after successful update)
  if (currentUser.avatar) {
    try {
      await cloudinaryDeleter(currentUser.avatar);
    } catch (error) {
      // Log the error but don't fail the request since the new avatar was uploaded successfully
      console.error('Failed to delete old avatar:', error);
    }
  }

  return res
    .status(200)
    .json(new APIresponse(200, user, 'Avatar updated successfully'));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new APIerror(400, 'Cover image is required');
  }

  const coverImage = await cloudinaryUploader(coverImageLocalPath);
  if (!coverImage.url) {
    throw new APIerror(400, 'Error uploading cover image');
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select('-password -refreshToken');

  return res
    .status(200)
    .json(new APIresponse(200, user, 'Cover image updated successfully'));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new APIerror(400, 'Username is missing');
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'channel',
        as: 'subscribers',
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'subscriber',
        as: 'subscribedTo',
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: '$subscribers',
        },
        subscribedToCount: {
          $size: '$subscribedTo',
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, '$subscribers.subscriber'] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscriberCount: 1,
        subscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new APIerror(404, 'Channel not found');
  }

  return res
    .status(200)
    .json(
      new APIresponse(200, channel[0], 'Channel profile fetched successfully')
    );
});

const getUserWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: 'videos',
        localField: 'watchHistory',
        foreignField: '_id',
        as: 'watchHistory',
        pipeline: [
          {
            $lookup: {
              from: 'users',
              localField: 'owner',
              foreignField: '_id',
              as: 'owner',
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: '$owner',
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new APIresponse(
        200,
        user[0].watchHistory,
        'User watch history fetched successfully'
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getUserWatchHistory,
};
