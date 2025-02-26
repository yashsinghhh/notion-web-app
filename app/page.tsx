import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      {/* User button in top right */}
      <div className="absolute top-4 right-4">
        <UserButton afterSignOutUrl="/sign-in"/>
      </div>

      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1 className="text-4xl font-bold">Protected Home Page</h1>
        <p>Welcome! Your user ID is: {userId}</p>
      </main>
    </div>
  );
}


// FOR EDIT PROFILE BUTTON


// app/page.tsx
// import { UserButton } from "@clerk/nextjs";
// import { auth } from "@clerk/nextjs/server";
// import Link from "next/link";

// export default async function Home() {
//   const { userId } = await auth();

//   return (
//     <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
//       {/* Top navigation area */}
//       <div className="absolute top-4 right-4 flex items-center gap-4">
//         <Link 
//           href="/profile/edit" 
//           className="text-sm font-medium hover:text-blue-600 transition-colors"
//         >
//           Edit Profile
//         </Link>
//         <UserButton afterSignOutUrl="/sign-in"/>
//       </div>

//       <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
//         <h1 className="text-4xl font-bold">Protected Home Page</h1>
//         <p>Welcome! Your user ID is: {userId}</p>
//       </main>
//     </div>
//   );
// }