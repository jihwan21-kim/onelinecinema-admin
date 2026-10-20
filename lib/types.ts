export type AdminUser = { id:string; email:string|null; created_at:string; display_name:string; handle:string; bio:string; is_admin:boolean; review_count:number };
export type Movie = { id:number; title:string; release_year:number; genres:string[] };
export type Review = { id:string; movie_id:number; movie_title:string; one_liner:string; tone:string; created_at:string; user_id:string; author_handle:string; upvotes:number; downvotes:number; model:string };
export type Vote = { review_id:string; user_id:string; voter_handle:string; one_liner:string; movie_title:string; value:number; created_at:string };
export type Stats = { users:number; profiles:number; movies:number; reviews:number; drafts:number; upvotes:number; downvotes:number };
export type Snapshot = { stats:Stats; users:AdminUser[]; movies:Movie[]; reviews:Review[]; votes:Vote[]; draft_summary:{model:string;tone:string;count:number}[] };
