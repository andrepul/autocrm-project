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
  Grid,
  LayoutGrid,
  LayoutList,
  MessageSquare,
  Edit2,
  X,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { TicketCard } from "./TicketCard";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

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
  const isMobile = useIsMobile();
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<TicketStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [sortField, setSortField] = useState<'created_at' | 'updated_at' | 'priority' | 'status'>('updated_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const queryClient = useQueryClient();

  // Fetch user profile to determine role
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const isWorkerOrAdmin = profile?.role === "worker" || profile?.role === "admin";

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets", statusFilter, priorityFilter, assigneeFilter, tagFilter, sortField, sortDirection],
    queryFn: async () => {
      console.log("Fetching filtered tickets...");
      console.log("Status filter:", statusFilter);
      console.log("Priority filter:", priorityFilter);
      console.log("Assignee filter:", assigneeFilter);
      console.log("Tag filter:", tagFilter);
      console.log("Sort field:", sortField);
      console.log("Sort direction:", sortDirection);
      
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
        `)
        .order(sortField, { ascending: sortDirection === 'asc' });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }
      if (priorityFilter) {
        query = query.eq("priority", parseInt(priorityFilter));
      }
      
      // Handle unassigned filter
      if (assigneeFilter === 'unassigned') {
        query = query.is('assigned_to', null);
      } else if (assigneeFilter && assigneeFilter !== 'all' && isAdmin) {
        query = query.eq("assigned_to", assigneeFilter);
      }

      // Handle tag filters
      if (tagFilter === 'untagged') {
        // Get all ticket IDs that have tags
        const { data: ticketIds, error: tagError } = await supabase
          .from('ticket_tags')
          .select('ticket_id');
        
        console.log('Untagged filter - ticket_tags query result:', { ticketIds, tagError });
        
        if (ticketIds && ticketIds.length > 0) {
          // Remove duplicates from the array of ticket IDs
          const uniqueTicketIds = [...new Set(ticketIds.map(t => t.ticket_id))];
          // Use .in with 'not' operator instead of .not('id', 'in', ...)
          query = query.not('id', 'in', `(${uniqueTicketIds.join(',')})`);
          console.log('Excluding tagged tickets:', uniqueTicketIds);
        } else {
          console.log('No tagged tickets found - returning all tickets as they are untagged');
        }
      } else if (tagFilter && tagFilter !== 'all') {
        // Existing tag filtering logic
        const { data: ticketIds } = await supabase
          .from('ticket_tags')
          .select('ticket_id')
          .eq('tag_id', tagFilter);
        
        if (ticketIds && ticketIds.length > 0) {
          query = query.in('id', ticketIds.map(t => t.ticket_id));
        } else {
          return [];
        }
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
      return;
    }

    toast({
      title: "Success",
      description: `Updated ${selectedTickets.size} tickets status`,
    });

    // Only clear selection for tickets that no longer match the current filter
    if (statusFilter && statusFilter !== newStatus) {
      setSelectedTickets(prev => {
        const newSelection = new Set(prev);
        Array.from(prev).forEach(id => newSelection.delete(id));
        return newSelection;
      });
    }

    queryClient.invalidateQueries({ queryKey: ["tickets"] });
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
      return;
    }

    toast({
      title: "Success",
      description: `Updated ${selectedTickets.size} tickets priority`,
    });

    // Only clear selection for tickets that no longer match the current filter
    if (priorityFilter && priorityFilter !== newPriority) {
      setSelectedTickets(prev => {
        const newSelection = new Set(prev);
        Array.from(prev).forEach(id => newSelection.delete(id));
        return newSelection;
      });
    }

    queryClient.invalidateQueries({ queryKey: ["tickets"] });
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
      return;
    }

    toast({
      title: "Success",
      description: `Assigned ${selectedTickets.size} tickets`,
    });

    // Only clear selection for tickets that no longer match the current filter
    if (assigneeFilter && assigneeFilter !== assigneeId) {
      setSelectedTickets(prev => {
        const newSelection = new Set(prev);
        Array.from(prev).forEach(id => newSelection.delete(id));
        return newSelection;
      });
    }

    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  const getStatusBadgeColor = (status: string | null) => {
    switch (status) {
      case "open":
        return "bg-blue-500";
      case "in_progress":
        return "bg-yellow-500";
      case "resolved":
        return "bg-green-500";
      case "closed":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getPriorityBadgeColor = (priority: number | null) => {
    switch (priority) {
      case 3:
        return "bg-red-500";
      case 2:
        return "bg-orange-500";
      case 1:
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getPriorityLabel = (priority: number | null) => {
    switch (priority) {
      case 3:
        return "High";
      case 2:
        return "Medium";
      case 1:
        return "Low";
      default:
        return "Unknown";
    }
  };

  const clearAllFilters = () => {
    setStatusFilter(null);
    setPriorityFilter(null);
    setAssigneeFilter(null);
    setTagFilter(null);
  };

  const hasActiveFilters = statusFilter || priorityFilter || assigneeFilter || tagFilter;

  const renderClearFiltersButton = () => {
    if (!hasActiveFilters) return null;

    if (isMobile) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={clearAllFilters}
          className="w-full h-9 mt-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          Clear All Filters
        </Button>
      );
    }

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={clearAllFilters}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5 mr-1" />
        Clear All
      </Button>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const renderListView = () => (
    <div className="space-y-2">
      {tickets.map((ticket) => (
        <div
          key={ticket.id}
          className="relative bg-white p-4 rounded-lg shadow flex items-center gap-4"
        >
          <Checkbox
            checked={selectedTickets.has(ticket.id)}
            onCheckedChange={(checked) => 
              handleSelectTicket(ticket.id, checked as boolean)
            }
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-sm truncate">{ticket.title}</h3>
              <Badge className={getStatusBadgeColor(ticket.status)}>
                {ticket.status}
              </Badge>
              <Badge className={getPriorityBadgeColor(ticket.priority)}>
                {getPriorityLabel(ticket.priority)}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 line-clamp-1">{ticket.description}</p>
            {ticket.ticket_tags && ticket.ticket_tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {ticket.ticket_tags.map(({ tags }) => (
                  <Badge
                    key={tags.id}
                    variant="secondary"
                    className="px-1 py-0 text-xs"
                  >
                    {tags.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowResponseDialog(true)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            {isWorkerOrAdmin && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowEditDialog(true)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center bg-white p-2.5 rounded-lg shadow">
        <div className={cn(
          "flex items-center gap-2",
          isMobile ? "w-full" : "flex-none"
        )}>
          <Filter className="h-3.5 w-3.5" />
          <span className="font-medium text-xs">Filters:</span>
        </div>
        
        <div className={cn(
          "flex flex-wrap gap-2 items-center",
          isMobile ? "w-full flex-col" : "flex-1"
        )}>
          <Select value={statusFilter ?? "all"} onValueChange={(value) => setStatusFilter(value === "all" ? null : value as TicketStatus)}>
            <SelectTrigger className="h-7 w-[120px] text-xs">
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
            <SelectTrigger className="h-7 w-[120px] text-xs">
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
            <SelectTrigger className="h-7 w-[120px] text-xs">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              <SelectItem value="untagged">(Untagged)</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && (
            <Select value={assigneeFilter ?? "all"} onValueChange={(value) => setAssigneeFilter(value === "all" ? null : value)}>
              <SelectTrigger className="h-7 w-[160px] text-xs">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">(Unassigned)</SelectItem>
                {workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.full_name || worker.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {!isMobile && renderClearFiltersButton()}
        </div>

        <div className={cn(
          "flex items-center gap-2",
          isMobile ? "w-full" : "ml-auto"
        )}>
          <Select 
            value={`${sortField}-${sortDirection}`} 
            onValueChange={(value) => {
              const [field, direction] = value.split('-');
              setSortField(field as 'created_at' | 'updated_at' | 'priority' | 'status');
              setSortDirection(direction as 'asc' | 'desc');
            }}
          >
            <SelectTrigger className="h-7 w-[160px] text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at-desc">Newest First</SelectItem>
              <SelectItem value="created_at-asc">Oldest First</SelectItem>
              <SelectItem value="updated_at-desc">Last Updated First</SelectItem>
              <SelectItem value="updated_at-asc">Last Updated Last</SelectItem>
              <SelectItem value="priority-desc">Highest Priority First</SelectItem>
              <SelectItem value="priority-asc">Lowest Priority First</SelectItem>
              <SelectItem value="status-asc">Status (Open First)</SelectItem>
              <SelectItem value="status-desc">Status (Closed First)</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center border rounded-md overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 rounded-none",
                viewMode === 'grid' ? "bg-accent text-accent-foreground" : "hover:bg-transparent hover:text-accent-foreground"
              )}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <div className="w-[1px] h-3.5 bg-border" />
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 rounded-none",
                viewMode === 'list' ? "bg-accent text-accent-foreground" : "hover:bg-transparent hover:text-accent-foreground"
              )}
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {isMobile && renderClearFiltersButton()}
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

          {viewMode === 'grid' ? (
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
          ) : (
            renderListView()
          )}
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