import UserProfile from "../../common/models/UserProfile";

// user.service.ts
export class UserService {
  static async getGeminiApiKey(userId: string): Promise<string | undefined> {
    const profile = await UserProfile.findOne({ userId })
      .select("+externalServices.gemini.apiKey")
      .exec();

    if (!profile?.externalServices?.gemini?.apiKey) {
      throw new Error("Gemini API key not found for user");
    }

    return profile.getGeminiKey(); // Use the method from the Mongoose document
  }
}
