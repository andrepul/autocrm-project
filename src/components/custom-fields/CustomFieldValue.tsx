import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tables } from "@/integrations/supabase/types";

type CustomField = Tables<"custom_fields">;

interface CustomFieldValueProps {
  field: CustomField & { value?: string | null };
  onValueChange: (value: string) => void;
}

export const CustomFieldValue = ({ field, onValueChange }: CustomFieldValueProps) => {
  if (field.field_type === "boolean") {
    return (
      <Select
        value={field.value || "false"}
        onValueChange={onValueChange}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      type={field.field_type === "number" ? "number" : field.field_type}
      value={field.value || ""}
      onChange={(e) => onValueChange(e.target.value)}
    />
  );
};