import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const getUserInitials = (displayName?: string | null) => {
  if (!displayName) return "U";
  return displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
};

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    // Segurança extra: se cair aqui sem user, manda para login
    navigate("/login", { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-md mx-auto bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6">
        <div className="flex flex-col items-center text-center">
          <Avatar className="h-16 w-16 mb-3">
            <AvatarImage src={user.photoURL || ""} alt={user.displayName || "Usuário"} />
            <AvatarFallback className="bg-ocean-primary/10 text-ocean-primary">
              {getUserInitials(user.displayName)}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-lg font-semibold">{user.displayName || "Usuário"}</h1>
          {user.email && (
            <p className="text-sm text-muted-foreground">{user.email}</p>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <Button className="w-full" variant="outline" onClick={() => navigate("/")}>Voltar ao início</Button>
          <Button className="w-full" variant="destructive" onClick={async () => {
            await signOut();
            navigate("/", { replace: true });
          }}>Sair</Button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
