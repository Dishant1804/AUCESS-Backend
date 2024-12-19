import jwt from 'jsonwebtoken'
import dotenv from 'dotenv';

dotenv.config();
const JWT_SECRET_KEY = process.env.JWT_SECRET

const authenticate = (roles) => {
  return (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized', success: false });

    jwt.verify(token, JWT_SECRET_KEY, (err, decoded) => {
      if (err) return res.status(403).json({ message: 'Invalid token', success: false  , err});

      if (!roles.includes(decoded.role)) {
        return res.status(403).json({ message: 'Access denied', success: false });
      }

      req.user = decoded;
      next();
    });
  };
};

export default authenticate;