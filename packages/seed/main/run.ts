import {
  bills,
  tags,
  dietSessions,
  createMiraiStances,
  createBillsTags,
  createInterviewConfig,
  createInterviewQuestions,
} from "./data";
import { createBillContents } from "./bill-contents-data";
import { createAdminClient, clearAllData } from "../shared/helper";

// ============================================================
// さいたま市版 PoC シード（最小単位）
// 投入順: tags → diet_sessions → bills → (active会期へ紐付け)
//        → bill_contents → mirai_stances → bills_tags
//        → interview_config → interview_questions
// 大量のダミーセッション/レポートは投入しない（PoC は実測主義。
// Grafana のパネルは実運用でインタビューを回すと埋まる）。
// ============================================================

async function seedDatabase() {
  const supabase = createAdminClient();
  console.log("🌱 Starting database seeding...");

  try {
    await clearAllData(supabase);

    // Insert tags
    console.log("🏷️  Inserting tags...");
    const { data: insertedTags, error: tagsError } = await supabase
      .from("tags")
      .insert(tags)
      .select("id, label");

    if (tagsError) {
      throw new Error(`Failed to insert tags: ${tagsError.message}`);
    }

    if (!insertedTags) {
      throw new Error("No tags were inserted");
    }

    console.log(`✅ Inserted ${insertedTags.length} tags`);

    // Insert diet sessions (= 定例会)
    console.log("🏛️  Inserting council sessions...");
    const { data: insertedDietSessions, error: dietSessionsError } =
      await supabase.from("diet_sessions").insert(dietSessions).select("id");

    if (dietSessionsError) {
      throw new Error(
        `Failed to insert council sessions: ${dietSessionsError.message}`
      );
    }

    if (!insertedDietSessions || insertedDietSessions.length === 0) {
      throw new Error("No council sessions were inserted");
    }

    console.log(`✅ Inserted ${insertedDietSessions.length} council sessions`);

    // Insert bills
    console.log("📄 Inserting bills...");
    const { data: insertedBills, error: billsError } = await supabase
      .from("bills")
      .insert(bills)
      .select("id, name");

    if (billsError) {
      throw new Error(`Failed to insert bills: ${billsError.message}`);
    }

    if (!insertedBills) {
      throw new Error("No bills were inserted");
    }

    console.log(`✅ Inserted ${insertedBills.length} bills`);

    // Link all bills to the active council session
    const activeSessionId = insertedDietSessions[0]?.id;
    if (activeSessionId) {
      const { error: linkError } = await supabase
        .from("bills")
        .update({ diet_session_id: activeSessionId })
        .in(
          "id",
          insertedBills.map((bill) => bill.id)
        );
      if (linkError) {
        throw new Error(
          `Failed to link bills to council session: ${linkError.message}`
        );
      }
      console.log(
        `🔗 Linked ${insertedBills.length} bills to the active council session`
      );
    }

    // Insert bill_contents
    console.log("📚 Inserting bill contents...");
    const billContents = createBillContents(insertedBills);

    const { data: insertedContents, error: contentsError } = await supabase
      .from("bill_contents")
      .insert(billContents)
      .select("id");

    if (contentsError) {
      throw new Error(
        `Failed to insert bill contents: ${contentsError.message}`
      );
    }

    if (!insertedContents) {
      throw new Error("No bill contents were inserted");
    }

    console.log(`✅ Inserted ${insertedContents.length} bill contents`);

    // Insert mirai_stances (= 論点整理)
    console.log("🎯 Inserting stances (論点整理)...");
    const miraiStances = createMiraiStances(insertedBills);

    const { data: insertedStances, error: stancesError } = await supabase
      .from("mirai_stances")
      .insert(miraiStances)
      .select("id");

    if (stancesError) {
      throw new Error(`Failed to insert stances: ${stancesError.message}`);
    }

    if (!insertedStances) {
      throw new Error("No stances were inserted");
    }

    console.log(`✅ Inserted ${insertedStances.length} stances`);

    // Insert bills_tags (関連付け)
    console.log("🔗 Inserting bills-tags relations...");
    const billsTags = createBillsTags(insertedBills, insertedTags);

    const { data: insertedBillsTags, error: billsTagsError } = await supabase
      .from("bills_tags")
      .insert(billsTags)
      .select();

    if (billsTagsError) {
      throw new Error(
        `Failed to insert bills-tags relations: ${billsTagsError.message}`
      );
    }

    if (!insertedBillsTags) {
      throw new Error("No bills-tags relations were inserted");
    }

    console.log(`✅ Inserted ${insertedBillsTags.length} bills-tags relations`);

    // Insert interview config (for first bill) + questions
    console.log("💬 Inserting interview config...");
    const interviewConfigData = createInterviewConfig(insertedBills);
    let insertedQuestionsCount = 0;

    if (interviewConfigData) {
      const { data: insertedConfig, error: configError } = await supabase
        .from("interview_configs")
        .insert(interviewConfigData)
        .select("id")
        .single();

      if (configError) {
        throw new Error(
          `Failed to insert interview config: ${configError.message}`
        );
      }

      if (insertedConfig) {
        console.log(`✅ Inserted interview config`);

        // Insert interview questions
        console.log("❓ Inserting interview questions...");
        const questionsData = createInterviewQuestions(insertedConfig.id);

        const { data: insertedQuestions, error: questionsError } =
          await supabase
            .from("interview_questions")
            .insert(questionsData)
            .select("id");

        if (questionsError) {
          throw new Error(
            `Failed to insert interview questions: ${questionsError.message}`
          );
        }

        if (insertedQuestions) {
          insertedQuestionsCount = insertedQuestions.length;
          console.log(
            `✅ Inserted ${insertedQuestionsCount} interview questions`
          );
        }
      }
    } else {
      console.log("⚠️ Skipped interview config (no bills found)");
    }

    console.log("🎉 Database seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`  Council Sessions: ${insertedDietSessions.length}`);
    console.log(`  Tags: ${insertedTags.length}`);
    console.log(`  Bills: ${insertedBills.length}`);
    console.log(`  Bill Contents: ${insertedContents.length}`);
    console.log(`  Stances: ${insertedStances.length}`);
    console.log(`  Bills-Tags Relations: ${insertedBillsTags.length}`);
    console.log(`  Interview Config: ${interviewConfigData ? 1 : 0}`);
    console.log(`  Interview Questions: ${insertedQuestionsCount}`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();
