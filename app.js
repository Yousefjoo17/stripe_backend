// app.js - Main application file
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const stripe = require('stripe')('sk_test_your_stripe_secret_key'); // Replace with your Stripe secret key

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key'; // In production, use environment variables

// Middleware
app.use(bodyParser.json());

// Data paths
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const PRODUCTS_FILE = path.join(__dirname, 'data', 'products.json');
const PAYMENTS_FILE = path.join(__dirname, 'data', 'payments.json');

// Helper functions for data access
const readDataFile = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, create directory if needed
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Return empty array if file doesn't exist
      return [];
    }
    throw error;
  }
};

const writeDataFile = (filePath, data) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Middleware for authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Access denied' });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid token' });
  }
};

// User Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const users = readDataFile(USERS_FILE);
    
    // Check if user already exists
    if (users.some(user => user.email === email)) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = {
      id: users.length + 1,
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeDataFile(USERS_FILE, users);

    // Create token
    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '1h' });
    
    res.status(201).json({ 
      message: 'User registered successfully',
      token,
      user: { id: newUser.id, username: newUser.username, email: newUser.email }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const users = readDataFile(USERS_FILE);
    const user = users.find(user => user.email === email);
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Create token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    
    res.json({ 
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Product Routes
app.get('/api/products', (req, res) => {
  try {
    const products = readDataFile(PRODUCTS_FILE);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const products = readDataFile(PRODUCTS_FILE);
    const product = products.find(p => p.id === parseInt(req.params.id));
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/products', authenticateToken, (req, res) => {
  try {
    const { name, price, details } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ message: 'Name and price are required' });
    }

    const products = readDataFile(PRODUCTS_FILE);
    
    const newProduct = {
      id: products.length + 1,
      name,
      price: parseFloat(price),
      details: details || '',
      createdAt: new Date().toISOString()
    };

    products.push(newProduct);
    writeDataFile(PRODUCTS_FILE, products);
    
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/products/:id', authenticateToken, (req, res) => {
  try {
    const { name, price, details } = req.body;
    const productId = parseInt(req.params.id);
    
    const products = readDataFile(PRODUCTS_FILE);
    const index = products.findIndex(p => p.id === productId);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const updatedProduct = {
      ...products[index],
      name: name || products[index].name,
      price: price !== undefined ? parseFloat(price) : products[index].price,
      details: details !== undefined ? details : products[index].details,
      updatedAt: new Date().toISOString()
    };
    
    products[index] = updatedProduct;
    writeDataFile(PRODUCTS_FILE, products);
    
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/products/:id', authenticateToken, (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const products = readDataFile(PRODUCTS_FILE);
    const filteredProducts = products.filter(p => p.id !== productId);
    
    if (filteredProducts.length === products.length) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    writeDataFile(PRODUCTS_FILE, filteredProducts);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Simplified Stripe Payment Routes
app.post('/api/create-payment-intent', authenticateToken, async (req, res) => {
  try {
    const { amount, description, paymentMethodType = 'card', currency = 'usd' } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    // Convert to cents for Stripe (amount should be in dollars from frontend)
    const amountInCents = Math.round(parseFloat(amount) * 100);
    
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency,
      description: description || 'Payment',
      payment_method_types: [paymentMethodType],
      metadata: {
        userId: req.user.id
      }
    });
    
    // Store payment record
    const payments = readDataFile(PAYMENTS_FILE);
    const newPayment = {
      id: payments.length + 1,
      userId: req.user.id,
      amount: parseFloat(amount),
      description: description || 'Payment',
      currency: currency,
      paymentIntentId: paymentIntent.id,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    payments.push(newPayment);
    writeDataFile(PAYMENTS_FILE, payments);
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentId: newPayment.id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = 'whsec_your_webhook_secret'; // Replace with your webhook secret

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      await handleSuccessfulPayment(paymentIntent);
      break;
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      await handleFailedPayment(failedPayment);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// Helper functions for payment handling
const handleSuccessfulPayment = async (paymentIntent) => {
  try {
    const payments = readDataFile(PAYMENTS_FILE);
    const paymentIndex = payments.findIndex(payment => payment.paymentIntentId === paymentIntent.id);
    
    if (paymentIndex !== -1) {
      payments[paymentIndex].status = 'succeeded';
      payments[paymentIndex].paidAt = new Date().toISOString();
      writeDataFile(PAYMENTS_FILE, payments);
    }
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
};

const handleFailedPayment = async (paymentIntent) => {
  try {
    const payments = readDataFile(PAYMENTS_FILE);
    const paymentIndex = payments.findIndex(payment => payment.paymentIntentId === paymentIntent.id);
    
    if (paymentIndex !== -1) {
      payments[paymentIndex].status = 'failed';
      payments[paymentIndex].failedAt = new Date().toISOString();
      writeDataFile(PAYMENTS_FILE, payments);
    }
  } catch (error) {
    console.error('Error handling failed payment:', error);
  }
};

// Payment history routes
app.get('/api/payments', authenticateToken, (req, res) => {
  try {
    const payments = readDataFile(PAYMENTS_FILE);
    const userPayments = payments.filter(payment => payment.userId === req.user.id);
    res.json(userPayments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/payments/:id', authenticateToken, (req, res) => {
  try {
    const payments = readDataFile(PAYMENTS_FILE);
    const payment = payments.find(p => p.id === parseInt(req.params.id) && p.userId === req.user.id);
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Initialize the server with dummy data
const initServer = () => {
  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Create users.json if it doesn't exist
  if (!fs.existsSync(USERS_FILE)) {
    const dummyUsers = require('./dummy-data/users');
    writeDataFile(USERS_FILE, dummyUsers);
  }
  
  // Create products.json if it doesn't exist
  if (!fs.existsSync(PRODUCTS_FILE)) {
    const dummyProducts = require('./dummy-data/products');
    writeDataFile(PRODUCTS_FILE, dummyProducts);
  }
  
  // Create payments.json if it doesn't exist
  if (!fs.existsSync(PAYMENTS_FILE)) {
    const dummyPayments = require('./dummy-data/payments');
    writeDataFile(PAYMENTS_FILE, dummyPayments);
  }
};

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initServer();
});

module.exports = app;