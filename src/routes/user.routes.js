import { Router } from 'express';
import {
  changeCurrentPassword,
  getCurrentUser,
  getUserChannelProfile,
  getUserWatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAccountDetails,
  updateAvatar,
  updateUserCoverImage,
} from '../controllers/user.controller.js';
import upload from '../middlewares/multer.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.route('/register').post(
  upload.fields([
    {
      name: 'avatar',
      maxCount: 1,
    },
    {
      name: 'coverImage',
    },
  ]),
  registerUser
);

router.route('/login').post(loginUser);

//secured routes
router.route('/logout').post(verifyJWT, logoutUser);
router.route('/refresh-token').post(refreshAccessToken);
router.route('/change-password').post(verifyJWT, changeCurrentPassword);
router.route('/current-user').get(verifyJWT, getCurrentUser);
router.route('/update-account-details').patch(verifyJWT, updateAccountDetails);

router
  .route('/update-avatar')
  .patch(verifyJWT, upload.single('avatar'), updateAvatar);

router
  .route('/update-cover-image')
  .patch(verifyJWT, upload.single('coverImage'), updateUserCoverImage);

router.route('/c/:username').get(verifyJWT, getUserChannelProfile);
router.route('/get-user-watch-history').get(verifyJWT, getUserWatchHistory);

export default router;
