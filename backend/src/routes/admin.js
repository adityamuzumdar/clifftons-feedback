const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const prisma = new PrismaClient();

// Create a new team
// POST /api/admin/teams
router.post('/teams', async (req, res) => {
  const { teamName } = req.body;
  if (!teamName?.trim()) return res.status(400).json({ error: 'teamName is required' });

  const team = await prisma.team.create({
    data: {
      name: teamName.trim(),
      adminToken: uuidv4(),
      inviteToken: uuidv4(),
    },
  });

  // viewTokens are never returned here — admin only gets adminToken + inviteToken
  res.json({ adminToken: team.adminToken, teamId: team.id, teamName: team.name });
});

// Get team overview — completion stats only, no feedback content, no view tokens
// GET /api/admin/:adminToken
router.get('/:adminToken', async (req, res) => {
  const team = await prisma.team.findUnique({
    where: { adminToken: req.params.adminToken },
    include: {
      members: {
        select: { id: true, name: true, hasSubmitted: true, submitToken: true },
        // viewToken intentionally omitted
      },
    },
  });

  if (!team) return res.status(404).json({ error: 'Team not found' });

  const submitted = team.members.filter((m) => m.hasSubmitted).length;

  res.json({
    teamName: team.name,
    inviteToken: team.inviteToken,
    feedbackOpen: team.feedbackOpen,
    members: team.members.map((m) => ({
      id: m.id,
      name: m.name,
      hasSubmitted: m.hasSubmitted,
      submitToken: m.submitToken,
      // viewToken NOT included — admin cannot view members' results
    })),
    completionStats: {
      submitted,
      total: team.members.length,
      percent: team.members.length ? Math.round((submitted / team.members.length) * 100) : 0,
    },
  });
});

// Manually add a member (fallback if someone doesn't self-register)
// POST /api/admin/:adminToken/members
router.post('/:adminToken/members', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const team = await prisma.team.findUnique({ where: { adminToken: req.params.adminToken } });
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const member = await prisma.member.create({
    data: {
      teamId: team.id,
      name: name.trim(),
      submitToken: uuidv4(),
      // viewToken is null until they submit — only they will ever see it
    },
  });

  // Return submitToken so admin can share it — but NOT viewToken
  res.json({ id: member.id, name: member.name, submitToken: member.submitToken });
});

// Open feedback round — locks registration, enables submissions
// POST /api/admin/:adminToken/open
router.post('/:adminToken/open', async (req, res) => {
  const team = await prisma.team.findUnique({ where: { adminToken: req.params.adminToken } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (team.feedbackOpen) return res.status(400).json({ error: 'Feedback is already open' });
  if (team.members?.length === 0) return res.status(400).json({ error: 'Add at least one member first' });

  await prisma.team.update({ where: { id: team.id }, data: { feedbackOpen: true } });
  res.json({ success: true });
});

// Remove a member (only if they haven't submitted)
// DELETE /api/admin/:adminToken/members/:memberId
router.delete('/:adminToken/members/:memberId', async (req, res) => {
  const team = await prisma.team.findUnique({ where: { adminToken: req.params.adminToken } });
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const member = await prisma.member.findFirst({
    where: { id: req.params.memberId, teamId: team.id },
  });
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (member.hasSubmitted) return res.status(400).json({ error: 'Cannot remove member who has already submitted' });

  await prisma.member.delete({ where: { id: member.id } });
  res.json({ success: true });
});

module.exports = router;
