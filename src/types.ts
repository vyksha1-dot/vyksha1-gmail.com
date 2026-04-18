export interface PotholeReport {
  id: string;
  userId: string;
  userEmail: string;
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
  };
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'customer' | 'technician' | 'admin';
  createdAt: number;
}
