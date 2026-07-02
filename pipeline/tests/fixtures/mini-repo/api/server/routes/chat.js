const express = require('express');
const { Message } = require('../models');
const logger = require('../logger');
const router = express.Router();

router.post('/chat', async (req, res) => {
  const completion = await openai.chat.completions.create({ messages: req.body.messages });
  const saved = await Message.create({ text: completion.choices[0].message.content });
  logger.info('message stored', { id: saved.id });
  res.json({ message: saved });
});

router.delete('/chat/:id', async (req, res) => {
  await Message.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
