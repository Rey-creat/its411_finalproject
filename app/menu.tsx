// app/menu.tsx
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Thought = {
  id?: string;
  description: string;
  epiphany?: boolean;
  createdBy?: { uid: string; email?: string };
  createdAt?: any;
};

type UserProfile = {
  id: string;
  email?: string;
  displayName?: string;
  bio?: string;
  profileImage?: string;
};

export default function Menu() {
  const router = useRouter();
  const [thoughtDescription, setThoughtDescription] = useState('');
  const [isEpiphany, setIsEpiphany] = useState(false);
  const [message, setMessage] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingThoughtId, setEditingThoughtId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [currentView, setCurrentView] = useState<'feed' | 'profile' | 'settings' | 'about'>('feed');
  const [darkMode, setDarkMode] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [profileImage, setProfileImage] = useState('');
  
  // Search states
  const [searchResults, setSearchResults] = useState<Thought[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchedUser, setSearchedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth().onAuthStateChanged(user => {
      if (user) {
        setUserEmail(user.email ?? null);
        
        // Load user profile data
        const userDoc = firestore().collection('users').doc(user.uid);
        userDoc.get().then(doc => {
          if (doc.exists) {
            const data = doc.data();
            setDisplayName(data?.displayName || '');
            setBio(data?.bio || '');
            setProfileImage(data?.profileImage || '');
            setDarkMode(data?.darkMode || false);
          }
        });

        const q = firestore().collection('thoughts').orderBy('createdAt', 'desc');

        const unsubscribeSnap = q.onSnapshot(
          snapshot => {
            if (!snapshot || !snapshot.docs) {
              setThoughts([]);
              return;
            }
            const allThoughts = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            })) as Thought[];
            setThoughts(allThoughts);
          },
          error => {
            console.error('Snapshot error', error);
            setThoughts([]);
          }
        );

        return () => unsubscribeSnap();
      } else {
        router.replace('/');
      }
    });

    return () => unsubscribeAuth();
  }, []);

  function openFormForEdit(thought: Thought) {
    setThoughtDescription(thought.description);
    setIsEpiphany(!!thought.epiphany);
    setEditingThoughtId(thought.id ?? null);
    setShowForm(true);
  }

  async function handleSubmit() {
    setMessage('');
    if (!thoughtDescription.trim()) {
      setMessage('Please write your thought.');
      return;
    }

    const currentUser = auth().currentUser;
    if (!currentUser) {
      Alert.alert('Not authenticated', 'Please log in again.');
      router.replace('/');
      return;
    }

    try {
      if (editingThoughtId) {
        await firestore().collection('thoughts').doc(editingThoughtId).update({
          description: thoughtDescription,
          epiphany: isEpiphany,
        });
        setMessage(`Thought updated successfully!`);
      } else {
        await firestore().collection('thoughts').add({
          description: thoughtDescription,
          epiphany: isEpiphany,
          createdBy: {
            uid: currentUser.uid,
            email: currentUser.email,
          },
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
        setMessage(`Thought submitted successfully!`);
      }

      setThoughtDescription('');
      setIsEpiphany(false);
      setEditingThoughtId(null);
      setShowForm(false);
    } catch (error: any) {
      console.error('Submit error', error);
      setMessage(error.message || 'Error saving thought.');
    }
  }

  function confirmDelete(thoughtId: string) {
    Alert.alert('Delete Thought', 'Are you sure you want to delete this thought?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => handleDelete(thoughtId),
      },
    ]);
  }

  async function handleDelete(thoughtId: string) {
    try {
      await firestore().collection('thoughts').doc(thoughtId).delete();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete.');
    }
  }

  async function toggleEpiphany(thought: Thought) {
    try {
      await firestore().collection('thoughts').doc(thought.id!).update({
        epiphany: !thought.epiphany,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update.');
    }
  }

  async function saveProfile() {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    try {
      await firestore().collection('users').doc(currentUser.uid).set({
        displayName,
        bio,
        profileImage,
        email: currentUser.email,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      
      setEditingProfile(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile.');
    }
  }

  async function toggleDarkMode() {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);

    try {
      await firestore().collection('users').doc(currentUser.uid).set({
        darkMode: newDarkMode,
      }, { merge: true });
    } catch (error: any) {
      console.error('Failed to save dark mode preference', error);
    }
  }

  function getInitials(email: string | undefined) {
    if (!email) return '?';
    return email.charAt(0).toUpperCase();
  }

  function getAvatarColor(email: string | undefined) {
    if (!email) return '#999';
    const colors = ['#C4A57B', '#B89968', '#A68A64', '#D4B896', '#8B7355'];
    const index = (email?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  }

  async function searchUsers(query: string) {
    if (!query.trim()) {
      setShowSearchResults(false);
      setSearchResults([]);
      setSearchedUser(null);
      return;
    }

    try {
      // Search users by email
      const usersSnapshot = await firestore()
        .collection('users')
        .where('email', '>=', query)
        .where('email', '<=', query + '\uf8ff')
        .get();

      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];

      setUserProfiles(users);
      
      if (users.length > 0) {
        // Get thoughts from the first matching user
        const user = users[0];
        setSearchedUser(user);
        
        const thoughtsSnapshot = await firestore()
          .collection('thoughts')
          .where('createdBy.uid', '==', user.id)
          .orderBy('createdAt', 'desc')
          .get();

        const userThoughts = thoughtsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Thought[];
        
        setSearchResults(userThoughts);
        setShowSearchResults(true);
        setCurrentView('feed');
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
        setSearchedUser(null);
        Alert.alert('No user found', 'No user found with that email');
      }
    } catch (error: any) {
      console.error('Search error', error);
      Alert.alert('Error', 'Failed to search users');
    }
  }

  function clearSearch() {
    setShowSearchResults(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchedUser(null);
  }

  const displayedThoughts = showSearchResults ? searchResults : thoughts;

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      {/* Top Black Dot */}
      <View style={styles.topDot} />

      {/* Header */}
      <View style={[styles.header, darkMode && styles.headerDark]}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>ReyRTalk</Text>
              <Text style={styles.logoIcon}>💬</Text>
              <Text style={styles.logoSubtext}>Notes</Text>
              <Text style={styles.logoStars}>★ ★ ★</Text>
            </View>
          </View>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search users by email..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => searchUsers(searchQuery)}
            />
            <TouchableOpacity 
              style={styles.searchButton} 
              onPress={() => searchUsers(searchQuery)}
            >
              <View style={styles.searchIconCircle}>
                <Text style={styles.searchIcon}>🔍</Text>
              </View>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.menuButton} onPress={() => setShowMenu(!showMenu)}>
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </TouchableOpacity>
        </View>

        {/* Dropdown Menu */}
        {showMenu && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => { setShowMenu(false); setCurrentView('feed'); clearSearch(); }}
            >
              <Text style={styles.menuItemText}>Home 🏠</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => { setShowMenu(false); setShowForm(true); }}
            >
              <Text style={styles.menuItemText}>My Thoughts ✍️</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => { setShowMenu(false); setCurrentView('profile'); clearSearch(); }}
            >
              <Text style={styles.menuItemText}>Profile 👤</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => { setShowMenu(false); setCurrentView('settings'); clearSearch(); }}
            >
              <Text style={styles.menuItemText}>Settings ⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => { setShowMenu(false); setCurrentView('about'); clearSearch(); }}
            >
              <Text style={styles.menuItemText}>About ℹ️</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.menuItem, styles.menuItemLast]} 
              onPress={() => {
                setShowMenu(false);
                auth().signOut().then(() => router.replace('/'));
              }}
            >
              <Text style={styles.menuItemText}>Logout 🚪</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Side Dots */}
      <View style={styles.sideDotsContainer}>
        {[...Array(30)].map((_, i) => (
          <View key={i} style={styles.sideDot} />
        ))}
      </View>

      {/* Main Content Area */}
      {currentView === 'feed' && (
        <>
          {/* Search Results Header */}
          {showSearchResults && searchedUser && (
            <View style={styles.searchResultsHeader}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={clearSearch}
              >
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
              <View style={styles.searchedUserInfo}>
                <View style={[styles.avatar, { backgroundColor: getAvatarColor(searchedUser.email) }]}>
                  <Text style={styles.avatarText}>
                    {searchedUser.profileImage || getInitials(searchedUser.email)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.searchedUserName}>
                    {searchedUser.displayName || searchedUser.email?.split('@')[0] || 'User'}
                  </Text>
                  <Text style={styles.searchedUserEmail}>{searchedUser.email}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Thought Feed */}
          <ScrollView style={styles.feedContainer} contentContainerStyle={styles.feedContent}>
            {displayedThoughts.length === 0 ? (
              <Text style={styles.noItems}>
                {showSearchResults ? 'No thoughts from this user.' : 'No thoughts yet.'}
              </Text>
            ) : (
              displayedThoughts.map(thought => (
                <View key={thought.id} style={styles.postWrapper}>
                  <View style={styles.postCard}>
                    <View style={styles.postHeader}>
                      <View style={[styles.avatar, { backgroundColor: getAvatarColor(thought.createdBy?.email) }]}>
                        <Text style={styles.avatarText}>{getInitials(thought.createdBy?.email)}</Text>
                      </View>
                      <Text style={styles.userName}>{thought.createdBy?.email?.split('@')[0] || 'Unknown'}</Text>
                    </View>

                    <Text style={styles.postContent}>
                      "{thought.description}" {thought.epiphany && '⭐'}
                    </Text>
                    
                    <Text style={styles.postTime}>
                      {thought.createdAt 
                        ? new Date(thought.createdAt.seconds * 1000).toLocaleString('en-US', { 
                            weekday: 'short',
                            hour: 'numeric', 
                            minute: '2-digit', 
                            hour12: true 
                          })
                        : 'Mon   9:30 AM'}
                    </Text>

                    {/* Action Buttons - Only show for current user's thoughts */}
                    {!showSearchResults && thought.createdBy?.uid === auth().currentUser?.uid && (
                      <View style={styles.postActions}>
                        <TouchableOpacity style={styles.actionButton} onPress={() => openFormForEdit(thought)}>
                          <Text style={styles.actionButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => confirmDelete(thought.id!)}>
                          <Text style={styles.actionButtonText}>Delete</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => toggleEpiphany(thought)}>
                          <Text style={styles.actionButtonText}>
                            {thought.epiphany ? 'Unmark ⭐' : 'Mark ⭐'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {/* Floating Add Button - Only show when not viewing search results */}
          {!showSearchResults && (
            <TouchableOpacity style={styles.floatingButton} onPress={() => setShowForm(true)}>
              <Text style={styles.floatingButtonText}>+</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Profile View */}
      {currentView === 'profile' && (
        <ScrollView style={styles.feedContainer} contentContainerStyle={styles.feedContent}>
          <View style={styles.pageContainer}>
            <Text style={[styles.pageTitle, darkMode && styles.textDark]}>Profile 👤</Text>
            
            <View style={[styles.profileCard, darkMode && styles.cardDark]}>
              {editingProfile ? (
                <>
                  <TouchableOpacity 
                    style={[styles.profileAvatar, { backgroundColor: getAvatarColor(userEmail || undefined) }]}
                    onPress={() => Alert.alert('Profile Picture', 'Choose a profile picture emoji or color')}
                  >
                    <Text style={styles.profileAvatarText}>
                      {profileImage || getInitials(userEmail || undefined)}
                    </Text>
                  </TouchableOpacity>
                  
                  <Text style={[styles.profileLabel, darkMode && styles.textDark]}>Emoji for Profile (e.g., 😊, 🎨, 🚀)</Text>
                  <TextInput
                    style={[styles.input, darkMode && styles.inputDark]}
                    placeholder="Enter emoji"
                    placeholderTextColor={darkMode ? '#999' : '#888'}
                    value={profileImage}
                    onChangeText={setProfileImage}
                  />

                  <Text style={[styles.profileLabel, darkMode && styles.textDark]}>Display Name</Text>
                  <TextInput
                    style={[styles.input, darkMode && styles.inputDark]}
                    placeholder="Your name"
                    placeholderTextColor={darkMode ? '#999' : '#888'}
                    value={displayName}
                    onChangeText={setDisplayName}
                  />

                  <Text style={[styles.profileLabel, darkMode && styles.textDark]}>Bio</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, darkMode && styles.inputDark]}
                    placeholder="Tell us about yourself..."
                    placeholderTextColor={darkMode ? '#999' : '#888'}
                    value={bio}
                    onChangeText={setBio}
                    multiline
                  />

                  <TouchableOpacity style={styles.profileButton} onPress={saveProfile}>
                    <Text style={styles.profileButtonText}>Save Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.profileButton, styles.secondaryProfileButton]} 
                    onPress={() => setEditingProfile(false)}
                  >
                    <Text style={[styles.profileButtonText, styles.secondaryProfileButtonText]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.profileAvatar, { backgroundColor: getAvatarColor(userEmail || undefined) }]}>
                    <Text style={styles.profileAvatarText}>
                      {profileImage || getInitials(userEmail || undefined)}
                    </Text>
                  </View>
                  
                  <Text style={[styles.profileName, darkMode && styles.textDark]}>
                    {displayName || userEmail?.split('@')[0] || 'User'}
                  </Text>
                  <Text style={[styles.profileEmail, darkMode && styles.textDark]}>{userEmail}</Text>
                  
                  {bio ? (
                    <Text style={[styles.profileBio, darkMode && styles.textDark]}>{bio}</Text>
                  ) : null}
                  
                  <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                      <Text style={[styles.statNumber, darkMode && styles.textDark]}>
                        {thoughts.filter(t => t.createdBy?.uid === auth().currentUser?.uid).length}
                      </Text>
                      <Text style={styles.statLabel}>My Thoughts</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statNumber, darkMode && styles.textDark]}>
                        {thoughts.filter(t => t.createdBy?.uid === auth().currentUser?.uid && t.epiphany).length}
                      </Text>
                      <Text style={styles.statLabel}>Epiphanies</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.profileButton} onPress={() => setEditingProfile(true)}>
                    <Text style={styles.profileButtonText}>Edit Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.profileButton, styles.secondaryProfileButton]} 
                    onPress={() => setCurrentView('feed')}
                  >
                    <Text style={[styles.profileButtonText, styles.secondaryProfileButtonText]}>Back to Feed</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Settings View */}
      {currentView === 'settings' && (
        <ScrollView style={styles.feedContainer} contentContainerStyle={styles.feedContent}>
          <View style={styles.pageContainer}>
            <Text style={[styles.pageTitle, darkMode && styles.textDark]}>Settings ⚙️</Text>
            
            <View style={[styles.settingsCard, darkMode && styles.cardDark]}>
              <View style={styles.settingItem}>
                <Text style={[styles.settingLabel, darkMode && styles.textDark]}>Email</Text>
                <Text style={styles.settingValue}>{userEmail}</Text>
              </View>
              
              <View style={styles.settingItem}>
                <Text style={[styles.settingLabel, darkMode && styles.textDark]}>Theme</Text>
                <TouchableOpacity 
                  style={[styles.toggleButton, darkMode && styles.toggleButtonActive]}
                  onPress={toggleDarkMode}
                >
                  <Text style={styles.toggleButtonText}>
                    {darkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.settingItem}>
                <Text style={[styles.settingLabel, darkMode && styles.textDark]}>Notifications</Text>
                <Text style={styles.settingValue}>Enabled</Text>
              </View>
              
              <View style={styles.settingItem}>
                <Text style={[styles.settingLabel, darkMode && styles.textDark]}>Privacy</Text>
                <Text style={styles.settingValue}>Public</Text>
              </View>

              <TouchableOpacity style={styles.profileButton} onPress={() => setCurrentView('feed')}>
                <Text style={styles.profileButtonText}>Back to Feed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* About View */}
      {currentView === 'about' && (
        <ScrollView style={styles.feedContainer} contentContainerStyle={styles.feedContent}>
          <View style={styles.pageContainer}>
            <Text style={styles.aboutPageTitle}>ABOUT</Text>
            
            <View style={styles.aboutCard}>
              <Text style={styles.aboutAppName}>ReyRTalk Notes</Text>
              
              <View style={styles.aboutSection}>
                <Text style={styles.aboutSectionTitle}>Description:</Text>
                <Text style={styles.aboutText}>
                  Tikalon Notes is a simple mobile app where you can freely write, share, and reflect on your random thoughts ✨. Whether it's a deep idea, a funny memory, or just something you want to remember, this app is your personal space for capturing moments and feelings.
                </Text>
              </View>

              <View style={styles.aboutSection}>
                <Text style={styles.aboutSectionTitle}>Features:</Text>
                <Text style={styles.aboutFeature}>• ✍️ Write and save your random thoughts</Text>
                <Text style={styles.aboutFeature}>• 🔍 Search your saved notes anytime</Text>
                <Text style={styles.aboutFeature}>• ⭐ Mark your favorite thoughts</Text>
                <Text style={styles.aboutFeature}>• 🔒 Secure storage with Firebase database</Text>
                <Text style={styles.aboutFeature}>• 🌙 Simple and clean dark-themed design</Text>
              </View>
              
              <View style={styles.aboutSection}>
                <Text style={styles.aboutSectionTitle}>What Makes Tikalon Notes Unique:</Text>
                <Text style={styles.aboutNumberedItem}>
                  1. 🌐 Ilonggo + English Support – Users can enjoy a bilingual experience, making the app more culturally connected and unique.
                </Text>
                <Text style={styles.aboutNumberedItem}>
                  2. 😊 Mood-based Thoughts – Tag your notes with moods and see your thoughts come alive with emojis and colors.
                </Text>
                <Text style={styles.aboutNumberedItem}>
                  3. 💡 Random Thought of the Day – Get daily inspiration or reflection delivered right inside the app.
                </Text>
              </View>

              <TouchableOpacity style={styles.profileButton} onPress={() => setCurrentView('feed')}>
                <Text style={styles.profileButtonText}>Back to Feed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Thought Form Modal */}
      <Modal visible={showForm} animationType="slide" transparent={true} onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingThoughtId ? 'Edit Thought' : 'Add New Thought'}</Text>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What's on your mind?"
              value={thoughtDescription}
              onChangeText={setThoughtDescription}
              multiline
              placeholderTextColor="#888"
            />

            <TouchableOpacity
              style={[styles.epiphanyToggle, isEpiphany && styles.epiphanyActive]}
              onPress={() => setIsEpiphany(!isEpiphany)}
            >
              <Text style={styles.epiphanyText}>
                {isEpiphany ? '⭐ Epiphany!' : 'Mark as Epiphany'}
              </Text>
            </TouchableOpacity>

            {message ? <Text style={styles.message}>{message}</Text> : null}

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>{editingThoughtId ? 'UPDATE' : 'SUBMIT'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowForm(false);
                setEditingThoughtId(null);
                setThoughtDescription('');
                setIsEpiphany(false);
                setMessage('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8e8e8',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  topDot: {
    position: 'absolute',
    top: 12,
    left: '50%',
    marginLeft: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#000',
    zIndex: 10,
  },
  header: {
    backgroundColor: '#f5f5f5',
    paddingTop: 40,
    paddingBottom: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  headerDark: {
    backgroundColor: '#2a2a2a',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    marginRight: 10,
  },
  logo: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
  },
  logoText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#000',
    lineHeight: 10,
  },
  logoIcon: {
    fontSize: 10,
    marginVertical: -1,
  },
  logoSubtext: {
    fontSize: 8,
    fontWeight: '700',
    color: '#000',
    lineHeight: 9,
  },
  logoStars: {
    fontSize: 7,
    color: '#000',
    letterSpacing: 1,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#000',
    paddingLeft: 12,
    paddingRight: 4,
    height: 36,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  searchButton: {
    padding: 4,
  },
  searchIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIcon: {
    fontSize: 12,
  },
  menuButton: {
    padding: 5,
    flexDirection: 'column',
    gap: 4,
  },
  menuLine: {
    width: 24,
    height: 3,
    backgroundColor: '#000',
    borderRadius: 1.5,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 60,
    right: 15,
    backgroundColor: '#999',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 100,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#777',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  sideDotsContainer: {
    position: 'absolute',
    left: 10,
    top: 110,
    bottom: 20,
    flexDirection: 'column',
    gap: 15,
    zIndex: 1,
    paddingBottom: 10,
  },
  sideDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000',
  },
  feedContainer: {
    flex: 1,
  },
  feedContent: {
    padding: 15,
    paddingLeft: 35,
    paddingBottom: 100,
  },
  // Search Results Styles
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  backButton: {
    marginRight: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#999',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  searchedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchedUserName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  searchedUserEmail: {
    fontSize: 14,
    color: '#666',
  },
  postWrapper: {
    marginBottom: 15,
  },
  postCard: {
    backgroundColor: '#d9d9d9',
    borderRadius: 15,
    padding: 15,
    borderWidth: 2,
    borderColor: '#000',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#000',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  postContent: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
    marginBottom: 8,
  },
  postTime: {
    fontSize: 11,
    color: '#666',
  },
  postActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#999',
  },
  actionButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#000',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#999',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#000',
  },
  floatingButtonText: {
    fontSize: 36,
    color: '#fff',
    fontWeight: '300',
  },
  noItems: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 12,
    width: '90%',
    maxWidth: 420,
    borderWidth: 2,
    borderColor: '#000',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#000',
  },
  inputDark: {
    backgroundColor: '#333',
    color: '#fff',
    borderColor: '#555',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  epiphanyToggle: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  epiphanyActive: {
    backgroundColor: '#ffe066',
    borderColor: '#000',
  },
  epiphanyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  message: {
    color: '#6b9fad',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#6b9fad',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#000',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  cancelButton: {
    padding: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  pageContainer: {
    flex: 1,
    padding: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
  },
  aboutPageTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 15,
    textAlign: 'center',
    letterSpacing: 2,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 25,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
  },
  cardDark: {
    backgroundColor: '#2a2a2a',
  },
  textDark: {
    color: '#fff',
  },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    marginBottom: 15,
  },
  profileAvatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 5,
  },
  profileEmail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  profileBio: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    alignSelf: 'flex-start',
    marginBottom: 5,
    marginTop: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  profileButton: {
    backgroundColor: '#6b9fad',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    marginTop: 10,
  },
  profileButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryProfileButton: {
    backgroundColor: 'transparent',
    borderColor: '#999',
  },
  secondaryProfileButtonText: {
    color: '#666',
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    borderWidth: 2,
    borderColor: '#000',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  settingValue: {
    fontSize: 16,
    color: '#666',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  toggleButtonActive: {
    backgroundColor: '#333',
    borderColor: '#555',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  aboutCard: {
    backgroundColor: '#e8e8e8',
    borderRadius: 15,
    padding: 20,
    borderWidth: 2,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 5,
  },
  aboutAppName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 15,
  },
  aboutVersion: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  aboutDescription: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  aboutSection: {
    marginBottom: 20,
  },
  aboutSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  aboutText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 5,
  },
  aboutFeature: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
    lineHeight: 20,
  },
  aboutNumberedItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
    lineHeight: 20,
  },
});