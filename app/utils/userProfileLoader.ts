export interface UserProfileSourceClient<
  UserData,
  ProfileData,
  ProfileAllData,
> {
  getUser(id: string): Promise<UserData>
  getUserProfileTop(id: string): Promise<ProfileData>
  getUserProfileAll(id: string): Promise<ProfileAllData>
}

export async function loadUserProfileSources<
  UserData,
  ProfileData,
  ProfileAllData,
>(
  client: UserProfileSourceClient<UserData, ProfileData, ProfileAllData>,
  id: string
): Promise<{
  userData: UserData
  profileData: ProfileData
  profileAllData: ProfileAllData | null
}> {
  const optionalProfile = client.getUserProfileAll(id).catch(() => null)
  const [userData, profileData, profileAllData] = await Promise.all([
    client.getUser(id),
    client.getUserProfileTop(id),
    optionalProfile,
  ])
  return { userData, profileData, profileAllData }
}
