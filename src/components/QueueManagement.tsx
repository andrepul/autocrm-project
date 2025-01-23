import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Filter,
  CheckSquare,
  Plus,
  ArrowDown,
  List,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { TicketCard } from "./TicketCard";
import { useToast } from "@/hooks/use-toast";

type TicketStatus = Database["public"]["Enums"]["ticket_status"];
type Ticket = Tables<"tickets"> & {
  ticket_tags?: {
    tags: Tables<"tags">;
  }[];
  profiles?: Tables<"profiles">;
};

interface QueueManagementProps {
  isAdmin: boolean;
}

export const QueueManagement = ({ isAdmin }: QueueManagementProps) => {
  const { toast } = useToast();
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<TicketStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets", statusFilter, priorityFilter, assigneeFilter, tagFilter],
    queryFn: async () => {
      console.log("Fetching filtered tickets...");
      console.log("Tag filter:", tagFilter);
      
      let query = supabase
        .from("tickets")
        .select(`
          *,
          ticket_tags (
            tags (
              id,
              name
            )
          ),
          profiles!tickets_assigned_to_fkey (
            id,
            full_name,
            email
          )
        `);

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }
      if (priorityFilter) {
        query = query.eq("priority", parseInt(priorityFilter));
      }
      if (assigneeFilter && isAdmin) {
        query = query.eq("assigned_to", assigneeFilter);
      }
      if (tagFilter) {
        // Join with ticket_tags to filter by tag_id
        query = query.eq('ticket_tags.tag_id', tagFilter);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching tickets:", error);
        throw error;
      }
      
      console.log("Fetched tickets:", data);
      return data as Ticket[];
    },
  });

  // Fetch workers for assignee filter (admin only)
  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("role", ["worker", "admin"]);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch all tags for tag filter
  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tags")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTickets(new Set(tickets.map(ticket => ticket.id)));
    } else {
      setSelectedTickets(new Set());
    }
  };

  const handleSelectTicket = (ticketId: string, checked: boolean) => {
    const newSelected = new Set(selectedTickets);
    if (checked) {
      newSelected.add(ticketId);
    } else {
      newSelected.delete(ticketId);
    }
    setSelectedTickets(newSelected);
  };

  const handleBulkStatusUpdate = async (newStatus: TicketStatus) => {
    const { error } = await supabase
      .from("tickets")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .in("id", Array.from(selectedTickets));

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update tickets status",
      });
    } else {
      toast({
        title: "Success",
        description: `Updated ${selectedTickets.size} tickets status`,
      });
      setSelectedTickets(new Set());
    }
  };

  const handleBulkPriorityUpdate = async (newPriority: string) => {
    const { error } = await supabase
      .from("tickets")
      .update({ 
        priority: parseInt(newPriority), 
        updated_at: new Date().toISOString() 
      })
      .in("id", Array.from(selectedTickets));

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update tickets priority",
      });
    } else {
      toast({
        title: "Success",
        description: `Updated ${selectedTickets.size} tickets priority`,
      });
      setSelectedTickets(new Set());
    }
  };

  const handleBulkAssign = async (assigneeId: string) => {
    const { error } = await supabase
      .from("tickets")
      .update({ 
        assigned_to: assigneeId, 
        updated_at: new Date().toISOString() 
      })
      .in("id", Array.from(selectedTickets));

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to assign tickets",
      });
    } else {
      toast({
        title: "Success",
        description: `Assigned ${selectedTickets.size} tickets`,
      });
      setSelectedTickets(new Set());
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-medium">Filters:</span>
        </div>
        
        <Select value={statusFilter ?? "all"} onValueChange={(value) => setStatusFilter(value === "all" ? null : value as TicketStatus)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter ?? "all"} onValueChange={(value) => setPriorityFilter(value === "all" ? null : value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="1">Low</SelectItem>
            <SelectItem value="2">Medium</SelectItem>
            <SelectItem value="3">High</SelectItem>
          </SelectContent>
        </Select>

        <Select value={tagFilter ?? "all"} onValueChange={(value) => setTagFilter(value === "all" ? null : value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdmin && (
          <Select value={assigneeFilter ?? "all"} onValueChange={(value) => setAssigneeFilter(value === "all" ? null : value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {workers.map((worker) => (
                <SelectItem key={worker.id} value={worker.id}>
                  {worker.full_name || worker.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {tickets.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={selectedTickets.size === tickets.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-500">
                {selectedTickets.size} selected
              </span>
            </div>

            {selectedTickets.size > 0 && (
              <div className="flex gap-2">
                <Select onValueChange={(value: TicketStatus) => handleBulkStatusUpdate(value)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Set Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>

                <Select onValueChange={handleBulkPriorityUpdate}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Set Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Low</SelectItem>
                    <SelectItem value="2">Medium</SelectItem>
                    <SelectItem value="3">High</SelectItem>
                  </SelectContent>
                </Select>

                {isAdmin && (
                  <Select onValueChange={handleBulkAssign}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Assign To" />
                    </SelectTrigger>
                    <SelectContent>
                      {workers.map((worker) => (
                        <SelectItem key={worker.id} value={worker.id}>
                          {worker.full_name || worker.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="relative">
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox
                    checked={selectedTickets.has(ticket.id)}
                    onCheckedChange={(checked) => 
                      handleSelectTicket(ticket.id, checked as boolean)
                    }
                  />
                </div>
                <TicketCard ticket={ticket} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tickets.length === 0 && (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <List className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No tickets found</h3>
          <p className="text-gray-500">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
};