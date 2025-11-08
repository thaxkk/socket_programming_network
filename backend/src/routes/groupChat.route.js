import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { 
    createGroupChat,
    getGroupChats,
    getGroupMessages,
    addMemberToGroup,
    removeMemberFromGroup
} from '../controllers/groupChat.controller.js';

const router = express.Router();

// Protect all routes
router.use( protectRoute );

// Group chat routes
router.post('/create', createGroupChat);
router.get('/all', getGroupChats);
router.get('/:groupId/messages', getGroupMessages);
router.post('/:groupId/members', addMemberToGroup);
router.delete('/:groupId/members/:memberId', removeMemberFromGroup);

export default router;