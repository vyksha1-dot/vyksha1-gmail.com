export interface PotholeReport {
  id: string;
  userId?: string;
  userEmail?: string;
  reporterName: string;
  reporterPhone: string;
  reporterEmail: string;
  imageUrl: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  status: 'pending' | 'in-progress' | 'repaired';
  paymentStatus: 'unpaid' | 'paid';
  price: number;
  createdAt: number;
  description?: string;
  severity: 'low' | 'medium' | 'high';
  measurements?: {
    widthInches: number;
    lengthInches: number;
    depthInches: number;
    size?: 'small' | 'medium' | 'large';
  };
  photoVerification?: {
    status: 'pending' | 'verified' | 'rejected';
    reason?: string;
    verifiedAt?: number;
    verifiedBy?: string;
  };
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'customer' | 'technician' | 'admin';
  createdAt: number;
}
