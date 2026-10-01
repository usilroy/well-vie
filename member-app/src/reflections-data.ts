import {allRows,result,type DB,type Intention} from './data.ts';

export type CompletedAffirmation={
  id:number;
  created_at:string;
  practices:{id:number;title:string;body_text:string|null;active:boolean};
};

// Keep the explicit member filter as well as the database's owner-only policies.
export function latestIntention(db:DB,memberID:string){
  return result<Intention|null>(db.from('intentions').select('id,text,created_at')
    .eq('user_id',memberID).order('created_at',{ascending:false})
    .order('id',{ascending:false}).limit(1).maybeSingle());
}

export function completedAffirmations(db:DB,memberID:string){
  return allRows<CompletedAffirmation>((from,to)=>db.from('practice_completions')
    .select('id,created_at,practices!inner(id,title,body_text,active,need_slug)')
    .eq('user_id',memberID).in('practices.need_slug',['affirmation','affirmations'])
    .order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,to));
}
