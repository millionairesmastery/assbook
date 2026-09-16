export type Profile = {
  id: string;
  handle: string;
  name: string;
  bio: string;
  avatar: string | null;
  demo: number;
  created: number;
  following?: number;
  followers?: number;
  blocked?: number;
  isAdmin?: boolean;
};
export type Post = {
  id: string;
  user_id: string;
  body: string;
  image: string | null;
  created: number;
  handle: string;
  name: string;
  avatar: string | null;
  demo: number;
  likes: number;
  comments: number;
  liked: number;
  saved: number;
};
export type Comment = {
  id: string;
  body: string;
  created: number;
  handle: string;
  name: string;
  avatar: string | null;
};
