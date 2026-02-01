import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getCollection } from '../config/mongodb';

const router = Router();

// User interface for type safety
interface User {
    _id: any;
    email: string;
    password_hash: string;
    full_name: string;
    role: string;
    active?: number;
    created_at?: Date;
    updated_at?: Date;
}

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.warn('[AUTH] WARNING: JWT_SECRET not set, using insecure fallback');
        return 'secret';
    }
    return secret;
};

// Login Route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const users = getCollection('users');
        const user = await users.findOne({ email }) as User | null;

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password_hash
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id.toString(), role: user.role, name: user.full_name },
            getJwtSecret(),
            { expiresIn: '24h' }
        );

        res.json({ 
            token, 
            user: { 
                id: user._id.toString(), 
                email: user.email, 
                role: user.role, 
                name: user.full_name 
            } 
        });
    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get Current User
router.get('/me', async (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const users = getCollection('users');
        const user = await users.findOne(
            { _id: req.user.id },
            { projection: { password_hash: 0 } }
        ) as User | null;
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            full_name: user.full_name
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

export default router;
