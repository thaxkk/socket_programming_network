import rateLimit from "express-rate-limit";

// Rate limiter for group creation
export const groupCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Max 10 groups per hour
  message: "Too many groups created. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for adding members
export const addMembersLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 member additions per 15 minutes
  message: "Too many member additions. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for group messages
export const groupMessageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Max 30 messages per minute per group
  message: "Too many messages. Please slow down.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Create unique key per user per group
    return `${req.user._id}_${req.params.groupId}`;
  },
});