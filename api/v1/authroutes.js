import express from 'express';

const router = express.Router();

router.get('/signin' , (req , res) => {
  res.json({"message" : "test"});
})

export default router;