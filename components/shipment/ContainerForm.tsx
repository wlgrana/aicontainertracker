"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { createContainer } from "@/app/actions/entry/actions";

export function ManualContainerForm() {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);

        const result = await createContainer(formData);

        setLoading(false);
        if (result.error) {
            alert("Error: " + result.error);
        } else {
            alert("Container Saved!");
            // Reset form?
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Manual Container Entry</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Container Number</Label>
                            <Input name="containerNumber" placeholder="MSCU1234567" required />
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select name="containerType">
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="20GP">20GP</SelectItem>
                                    <SelectItem value="40GP">40GP</SelectItem>
                                    <SelectItem value="40HC">40HC</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Size</Label>
                            <Input name="size" placeholder="40" />
                        </div>
                        <div className="space-y-2">
                            <Label>Carrier (Text)</Label>
                            <Input name="carrier" placeholder="Maersk" />
                        </div>
                    </div>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Saving..." : "Save Container"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
