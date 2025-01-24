import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CustomFieldForm } from "./custom-fields/CustomFieldForm";
import { CustomFieldHeader } from "./custom-fields/CustomFieldHeader";
import { CustomFieldValue } from "./custom-fields/CustomFieldValue";

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
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      loadCustomFields();
    }
  }, [open]);

  const loadCustomFields = async () => {
    console.log("Loading custom fields...");
    const { data: fields, error: fieldsError } = await supabase
      .from("custom_fields")
      .select("*")
      .order("name");

    if (fieldsError) {
      console.error("Error loading custom fields:", fieldsError);
      return;
    }

    const { data: values, error: valuesError } = await supabase
      .from("ticket_custom_fields")
      .select("*")
      .eq("ticket_id", ticket.id);

    if (valuesError) {
      console.error("Error loading custom field values:", valuesError);
      return;
    }

    const fieldsWithValues = fields.map(field => ({
      ...field,
      value: values?.find(v => v.field_id === field.id)?.value,
      valueId: values?.find(v => v.field_id === field.id)?.id
    }));

    console.log("Loaded fields with values:", fieldsWithValues);
    setCustomFields(fieldsWithValues);
  };

  const handleCreateField = async (name: string, fieldType: "text" | "number" | "date" | "boolean") => {
    const { error } = await supabase
      .from("custom_fields")
      .insert({
        name: name.trim(),
        field_type: fieldType,
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

    loadCustomFields();
  };

  const handleDeleteField = async (fieldId: string) => {
    const { error } = await supabase
      .from("custom_fields")
      .delete()
      .eq("id", fieldId);

    if (error) {
      console.error("Error deleting custom field:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete custom field",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Custom field deleted successfully",
    });

    loadCustomFields();
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  const handleStartEdit = (field: CustomFieldWithValue) => {
    setEditingField(field.id);
    setEditingName(field.name);
  };

  const handleSaveEdit = async (fieldId: string) => {
    if (!editingName.trim()) return;

    const { error } = await supabase
      .from("custom_fields")
      .update({ name: editingName.trim() })
      .eq("id", fieldId);

    if (error) {
      console.error("Error updating custom field:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update custom field",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Custom field updated successfully",
    });

    setEditingField(null);
    loadCustomFields();
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  const handleUpdateFieldValue = async (field: CustomFieldWithValue, value: string) => {
    if (field.valueId) {
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
            <CustomFieldForm onSubmit={handleCreateField} />
          )}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Field Values</h3>
            {customFields.map((field) => (
              <div key={field.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <CustomFieldHeader
                    field={field}
                    isAdmin={isAdmin}
                    isEditing={editingField === field.id}
                    editingName={editingName}
                    onStartEdit={() => handleStartEdit(field)}
                    onSaveEdit={() => handleSaveEdit(field.id)}
                    onCancelEdit={() => setEditingField(null)}
                    onDelete={() => handleDeleteField(field.id)}
                    onEditingNameChange={setEditingName}
                  />
                </div>
                <CustomFieldValue
                  field={field}
                  onValueChange={(value) => handleUpdateFieldValue(field, value)}
                />
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};