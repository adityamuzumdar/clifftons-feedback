const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/submit/:submitToken — fetch members to rate, including their public keys for encryption
router.get('/:submitToken', async (req, res) => {
  const member = await prisma.member.findUnique({
    where: { submitToken: req.params.submitToken },
    include: {
      team: {
        include: {
          members: { select: { id: true, name: true, publicKeyJwk: true } },
        },
      },
    },
  });

  if (!member) return res.status(404).json({ error: 'Invalid or expired link' });
  if (!member.team.feedbackOpen) return res.status(403).json({ error: 'feedback_not_open' });
  if (member.hasSubmitted) return res.status(409).json({ error: 'already_submitted' });

  const others = member.team.members
    .filter((m) => m.id !== member.id)
    .map((m) => ({
      id: m.id,
      name: m.name,
      publicKeyJwk: m.publicKeyJwk ? JSON.parse(m.publicKeyJwk) : null,
    }));

  res.json({ submitterName: member.name, teamName: member.team.name, membersToRate: others });
});

// POST /api/submit/:submitToken — submit encrypted feedback
// Body: { feedbacks: [{ memberId, ephemeralPubKey, encryptedData, iv }] }
// Server stores opaque blobs — it cannot read the content.
router.post('/:submitToken', async (req, res) => {
  const member = await prisma.member.findUnique({
    where: { submitToken: req.params.submitToken },
    include: { team: { include: { members: { select: { id: true } } } } },
  });

  if (!member) return res.status(404).json({ error: 'Invalid or expired link' });
  if (!member.team.feedbackOpen) return res.status(403).json({ error: 'feedback_not_open' });
  if (member.hasSubmitted) return res.status(409).json({ error: 'already_submitted' });

  const { feedbacks } = req.body;
  if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
    return res.status(400).json({ error: 'feedbacks array is required' });
  }

  const validMemberIds = new Set(member.team.members.map((m) => m.id).filter((id) => id !== member.id));

  for (const f of feedbacks) {
    if (!validMemberIds.has(f.memberId)) return res.status(400).json({ error: `Invalid memberId: ${f.memberId}` });
    if (!f.ephemeralPubKey || !f.encryptedData || !f.iv) {
      return res.status(400).json({ error: 'Each feedback must include ephemeralPubKey, encryptedData, and iv' });
    }
  }

  await prisma.$transaction([
    ...feedbacks.map((f) =>
      prisma.feedback.create({
        data: {
          targetMemberId: f.memberId,
          ephemeralPubKey: f.ephemeralPubKey,
          encryptedData: f.encryptedData,
          iv: f.iv,
        },
      })
    ),
    prisma.member.update({
      where: { id: member.id },
      data: { hasSubmitted: true },
    }),
  ]);

  res.json({ success: true });
});

module.exports = router;
