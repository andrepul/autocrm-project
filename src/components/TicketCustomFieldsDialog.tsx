import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type Ticket = Tables<"tickets">;
type CustomField = Tables<"custom_fields">;
type CustomFieldValue = Tables<"ticket_custom_fields">;

interface CustomFieldWithValue extends CustomField {
  value?: string | null;
  valueId?: string;
}

interface TicketCustomFieldsDialogProps {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}

export const TicketCustomFieldsDialog = ({
  ticket,
  open,
  onOpenChange,
  isAdmin,
}: TicketCustomFieldsDialogProps) => {
  const [customFields, setCustomFields] = useState<CustomFieldWithValue[]>([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number" | "date" | "boolean">("text");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      loadCustomFields();
    }
  }, [open]);

  const loadCustomFields = async () => {
    // Load custom fields definitions
    const { data: fields, error: fieldsError } = await supabase
      .from("custom_fields")
      .select("*")
      .order("name");

    if (fieldsError) {
      console.error("Error loading custom fields:", fieldsError);
      return;
    }

    // Load custom field values for this ticket
    const { data: values, error: valuesError } = await supabase
      .from("ticket_custom_fields")
      .select("*")
      .eq("ticket_id", ticket.id);

    if (valuesError) {
      console.error("Error loading custom field values:", valuesError);
      return;
    }

    // Combine fields with their values
    const fieldsWithValues = fields.map(field => ({
      ...field,
      value: values?.find(v => v.field_id === field.id)?.value,
      valueId: values?.find(v => v.field_id === field.id)?.id
    }));

    setCustomFields(fieldsWithValues);
  };

  const handleCreateField = async () => {
    if (!newFieldName.trim()) return;

    const { error } = await supabase
      .from("custom_fields")
      .insert({
        name: newFieldName.trim(),
        field_type: newFieldType,
      });

    if (error) {
      console.error("Error creating custom field:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create custom field",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Custom field created successfully",
    });

    setNewFieldName("");
    loadCustomFields();
  };

  const handleUpdateFieldValue = async (field: CustomFieldWithValue, value: string) => {
    if (field.valueId) {
      // Update existing value
      const { error } = await supabase
        .from("ticket_custom_fields")
        .update({ value })
        .eq("id", field.valueId);

      if (error) {
        console.error("Error updating custom field value:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update custom field value",
        });
        return;
      }
    } else {
      // Create new value
      const { error } = await supabase
        .from("ticket_custom_fields")
        .insert({
          ticket_id: ticket.id,
          field_id: field.id,
          value,
        });

      if (error) {
        console.error("Error creating custom field value:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create custom field value",
        });
        return;
      }
    }

    loadCustomFields();
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Custom Fields</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isAdmin && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Create New Field</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Field name"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                />
                <Select value={newFieldType} onValueChange={(value: any) => setNewFieldType(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleCreateField}>Create</Button>
              </div>
            </div>
          )}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Field Values</h3>
            {customFields.map((field) => (
              <div key={field.id} className="space-y-2">
                <label className="text-sm font-medium">{field.name}</label>
                {field.field_type === "boolean" ? (
                  <Select
                    value={field.value || "false"}
                    onValueChange={(value) => handleUpdateFieldValue(field, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={field.field_type === "number" ? "number" : field.field_type}
                    value={field.value || ""}
                    onChange={(e) => handleUpdateFieldValue(field, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};