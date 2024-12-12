import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
const dotenvParsed = dotenv.config().parsed;
const JWT_SECRET_MIDDLEWARE = dotenvParsed.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
  const token = req.cookies;
  console.log( token);

  if (!token) {
    return res.status(401).json({ "error": "Unauthorized" , "success" : false });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET_MIDDLEWARE);
    req.user = decoded;
    next();
  } 
  catch (err) {
    return res.status(500).json({ "error": "Internal Server Error" });
  }
};

export default authMiddleware;