const express = require('express');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/results/:viewSecret
// Client sends viewSecret (from their saved link).
// Server hashes it to find the member, returns encrypted blobs + encrypted private key.
// Decryption happens entirely in the browser — server never sees plaintext.
router.get('/:viewSecret', async (req, res) => {
  const hash = crypto.createHash('sha256').update(req.params.viewSecret, 'base64').digest('base64');

  const member = await prisma.member.findUnique({
    where: { viewTokenHash: hash },
    include: {
      feedbacksReceived: {
        select: { ephemeralPubKey: true, encryptedData: true, iv: true },
      },
      team: { select: { name: true } },
    },
  });

  if (!member) return res.status(404).json({ error: 'Invalid results link' });

  res.json({
    memberName: member.name,
    teamName: member.team.name,
    // Encrypted private key — browser decrypts this with the viewSecret to get the private key
    encryptedPrivateKey: member.encryptedPrivateKey,
    privateKeyIv: member.privateKeyIv,
    // Encrypted feedback blobs — browser decrypts each with the recovered private key
    encryptedFeedbacks: member.feedbacksReceived,
  });
});

module.exports = router;
