const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ciclovest_secret_key';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'Token de acesso requerido' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Erro na verificação do token:', err);
      return res.status(403).json({ 
        success: false,
        error: 'Token inválido' 
      });
    }
    req.user = user;
    next();
  });
};

module.exports = authenticateToken;
