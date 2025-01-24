import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";

type Profile = Tables<"profiles">;

export const UserRoleManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*");
    if (error) {
      console.error("Error fetching users:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch users.",
      });
    } else {
      setUsers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: "customer" | "worker" | "admin") => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          role: newRole 
        })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Role updated",
        description: "User role has been successfully updated."
      });

      // Refresh the users list
      await fetchUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update user role. Please try again."
      });
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold">User Role Management</h2>
      <ul>
        {users.map((user) => (
          <li key={user.id} className="flex justify-between items-center">
            <span>{user.full_name || user.email}</span>
            <select
              value={user.role || ""}
              onChange={(e) => handleRoleChange(user.id, e.target.value as "customer" | "worker" | "admin")}
            >
              <option value="customer">Customer</option>
              <option value="worker">Worker</option>
              <option value="admin">Admin</option>
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UserRoleManagement;