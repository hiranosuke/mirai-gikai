"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

import { createDiscussionPoints } from "../../server/actions/create-discussion-points";
import { deleteDiscussionPoints } from "../../server/actions/delete-discussion-points";
import { updateDiscussionPoints } from "../../server/actions/update-discussion-points";
import {
  type DiscussionPoints,
  type DiscussionPointsInput,
  discussionPointsInputSchema,
} from "../../shared/types";

interface DiscussionPointsFormProps {
  billId: string;
  discussionPoints?: DiscussionPoints | null;
}

export function DiscussionPointsForm({
  billId,
  discussionPoints,
}: DiscussionPointsFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<DiscussionPointsInput>({
    resolver: zodResolver(discussionPointsInputSchema),
    defaultValues: {
      pro_points: discussionPoints?.pro_points || "",
      con_points: discussionPoints?.con_points || "",
    },
  });

  const handleSubmit = async (data: DiscussionPointsInput) => {
    setIsSubmitting(true);
    try {
      const result = discussionPoints
        ? await updateDiscussionPoints(discussionPoints.id, data)
        : await createDiscussionPoints(billId, data);

      if (result.success) {
        toast.success(
          discussionPoints
            ? "考えるヒントを更新しました"
            : "考えるヒントを作成しました"
        );
        router.refresh();
      } else {
        toast.error(result.error || "エラーが発生しました");
      }
    } catch (error) {
      console.error("Error submitting discussion points:", error);
      toast.error("予期しないエラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (
      !discussionPoints ||
      !confirm("この考えるヒントを削除してもよろしいですか？")
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteDiscussionPoints(discussionPoints.id);

      if (result.success) {
        toast.success("考えるヒントを削除しました");
        window.location.reload();
      } else {
        toast.error(result.error || "削除に失敗しました");
      }
    } catch (error) {
      console.error("Error deleting discussion points:", error);
      toast.error("予期しないエラーが発生しました");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>考えるヒント</CardTitle>
        <p className="text-sm text-muted-foreground">
          賛成・反対それぞれの理由を中立に併記します。特定の立場を推奨する内容にはしないでください。
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="pro_points"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>賛成する理由（任意）</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="賛成する理由を入力"
                      className="min-h-[120px] resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="con_points"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>反対する理由（任意）</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="反対する理由を入力"
                      className="min-h-[120px] resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "保存中..."
                  : discussionPoints
                    ? "更新"
                    : "作成"}
              </Button>
              {discussionPoints && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting ? "削除中..." : "削除"}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
