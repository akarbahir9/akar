export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:2';

export interface ImagePart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

export interface TextPart {
  text: string;
}

// FIX: Add missing AuthUser type to be used for authenticated user data.
export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
