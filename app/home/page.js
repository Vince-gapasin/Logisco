import supabase from "../../config/supabaseClient"

export default function Home() {
 
  console.log(supabase)

  return (
    <div className="page home">
      <h2>Home</h2>
      <p>Check your VS Code terminal for the Supabase object!</p>
    </div>
  )
}