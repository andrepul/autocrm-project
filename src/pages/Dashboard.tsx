import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CreateTicketDialog } from "@/components/CreateTicketDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRoleManagement } from "@/components/UserRoleManagement";
import { TicketCard } from "@/components/TicketCard";

type Profile = Tables<"profiles">;
type Ticket = Tables<"tickets">;

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const queryClient = useQueryClient();

  // Fetch user profile
  const { data: profileData, error: profileError } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      console.log("Fetching profile...");
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("No authenticated user");
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        throw error;
      }

      console.log("Fetched profile:", data);
      return data as Profile;
    },
  });

  useEffect(() => {
    if (profileData) {
      setProfile(profileData);
    }
    if (profileError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not fetch user profile",
      });
      navigate("/");
    }
  }, [profileData, profileError, navigate, toast]);

  // Add real-time subscription for tickets and responses
  useEffect(() => {
    const channel = supabase
      .channel('public:tickets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tickets'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_responses'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tickets'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      console.log("Fetching tickets...");
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          ticket_tags (
            tags (
              id,
              name
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Error signing out",
        description: error.message,
      });
    } else {
      toast({
        title: "Signed out",
        description: "Successfully signed out of your account.",
      });
      navigate("/");
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500">Welcome, {profile?.full_name || profile?.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge>{profile?.role}</Badge>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Ticket Management</h2>
            <CreateTicketDialog />
          </div>

          <Tabs defaultValue="tickets" className="w-full">
            <TabsList>
              <TabsTrigger value="tickets">Tickets</TabsTrigger>
              {profile?.role === "admin" && (
                <TabsTrigger value="users">User Management</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="tickets">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tickets?.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            </TabsContent>

            {profile?.role === "admin" && (
              <TabsContent value="users">
                <UserRoleManagement />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
