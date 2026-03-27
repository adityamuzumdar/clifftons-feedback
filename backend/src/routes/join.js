const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/join/:inviteToken — fetch team name for the join page
router.get('/:inviteToken', async (req, res) => {
  const team = await prisma.team.findUnique({
    where: { inviteToken: req.params.inviteToken },
    select: { name: true },
  });
  if (!team) return res.status(404).json({ error: 'Invalid invite link' });
  res.json({ teamName: team.name });
});

// POST /api/join/:inviteToken — self-register
// Client generates the ECDH key pair and viewSecret in the browser.
// Server never sees the viewSecret — only its SHA-256 hash for lookup.
router.post('/:inviteToken', async (req, res) => {
  const { name, publicKeyJwk, encryptedPrivateKey, privateKeyIv, viewTokenHash } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  if (!publicKeyJwk || !encryptedPrivateKey || !privateKeyIv || !viewTokenHash) {
    return res.status(400).json({ error: 'Crypto fields are required' });
  }

  const team = await prisma.team.findUnique({ where: { inviteToken: req.params.inviteToken } });
  if (!team) return res.status(404).json({ error: 'Invalid invite link' });
  if (team.feedbackOpen) return res.status(409).json({ error: 'registration_closed' });

  const allMembers = await prisma.member.findMany({ where: { teamId: team.id }, select: { name: true } });
  const duplicate = allMembers.some((m) => m.name.toLowerCase() === name.trim().toLowerCase());
  if (duplicate) return res.status(409).json({ error: 'A member with this name already exists in the team' });

  const member = await prisma.member.create({
    data: {
      teamId: team.id,
      name: name.trim(),
      submitToken: uuidv4(),
      publicKeyJwk: JSON.stringify(publicKeyJwk),
      encryptedPrivateKey,
      privateKeyIv,
      viewTokenHash,
    },
  });

  res.json({ submitToken: member.submitToken, memberName: member.name, teamName: team.name });
});

module.exports = router;
