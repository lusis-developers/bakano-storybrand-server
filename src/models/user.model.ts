import { Schema, model, Document, Types } from 'mongoose';



export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  birthDate?: Date;
  businesses: Types.ObjectId[];
  role: 'admin' | 'client';
  isVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  onboarding?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  birthDate: {
    type: Date,
    validate: {
      validator: function(date: Date | undefined) {
        return !date || date < new Date();
      },
      message: 'Birth date must be before current date'
    }
  },
  businesses: [{
    type: Schema.Types.ObjectId,
    ref: 'Business'
  }],
  role: {
    type: String,
    enum: ['admin', 'client'],
    default: 'client'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String,
    select: false
  },
  verificationTokenExpires: {
    type: Date,
    select: false
  },
  onboarding: {
    type: Schema.Types.ObjectId,
    ref: 'Onboarding'
  }
}, {
  timestamps: true,
  versionKey: false,
});

userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('age').get(function() {
  if (!this.birthDate) {
    return null;
  }
  
  const today = new Date();
  const birth = new Date(this.birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
});



userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

export const User = model<IUser>('User', userSchema);

export default User;