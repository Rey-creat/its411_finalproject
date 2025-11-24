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
  title: string;
  description: string;
  tag: string;
  epiphany?: boolean;
  createdBy?: { uid: string; email?: string };
  createdAt?: any;
};

export default function Menu() {
  const router = useRouter();
  const [thoughtTitle, setThoughtTitle] = useState('');
  const [thoughtDescription, setThoughtDescription] = useState('');
  const [thoughtTag, setThoughtTag] = useState('');
  const [isEpiphany, setIsEpiphany] = useState(false);
  const [message, setMessage] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingThoughtId, setEditingThoughtId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = auth().onAuthStateChanged(user => {
      if (user) {
        setUserEmail(user.email ?? null);

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
    setThoughtTitle(thought.title);
    setThoughtDescription(thought.description);
    setThoughtTag(thought.tag);
    setIsEpiphany(!!thought.epiphany);
    setEditingThoughtId(thought.id ?? null);
    setShowForm(true);
  }

  async function handleSubmit() {
    setMessage('');
    if (!thoughtTitle.trim() || !thoughtDescription.trim() || !thoughtTag.trim()) {
      setMessage('Please fill out all fields.');
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
          title: thoughtTitle,
          description: thoughtDescription,
          tag: thoughtTag,
          epiphany: isEpiphany,
        });
        setMessage(`Thought "${thoughtTitle}" updated successfully!`);
      } else {
        await firestore().collection('thoughts').add({
          title: thoughtTitle,
          description: thoughtDescription,
          tag: thoughtTag,
          epiphany: isEpiphany,
          createdBy: {
            uid: currentUser.uid,
            email: currentUser.email,
          },
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
        setMessage(`Thought "${thoughtTitle}" submitted successfully!`);
      }

      setThoughtTitle('');
      setThoughtDescription('');
      setThoughtTag('');
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

  const filteredThoughts = searchQuery
    ? thoughts.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tag.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : thoughts;

  return (
    <View style={styles.container}>
      {/* Top Black Dot */}
      <View style={styles.topDot} />

      {/* Header */}
      <View style={styles.header}>
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
              placeholder="Search"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity style={styles.searchButton}>
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
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
              <Text style={styles.menuItemText}>Home 🏠</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setShowForm(true); }}>
              <Text style={styles.menuItemText}>My Thoughts ✍️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
              <Text style={styles.menuItemText}>Profile 👤</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
              <Text style={styles.menuItemText}>Settings ⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
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

      {/* Thought Feed */}
      <ScrollView style={styles.feedContainer} contentContainerStyle={styles.feedContent}>
        {filteredThoughts.length === 0 ? (
          <Text style={styles.noItems}>No thoughts yet.</Text>
        ) : (
          filteredThoughts.map(thought => (
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

                {/* Action Buttons */}
                {thought.createdBy?.uid === auth().currentUser?.uid && (
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

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.floatingButton} onPress={() => setShowForm(true)}>
        <Text style={styles.floatingButtonText}>+</Text>
      </TouchableOpacity>

      {/* Thought Form Modal */}
      <Modal visible={showForm} animationType="slide" transparent={true} onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingThoughtId ? 'Edit Thought' : 'Add New Thought'}</Text>

            <TextInput
              style={styles.input}
              placeholder="Title"
              value={thoughtTitle}
              onChangeText={setThoughtTitle}
              placeholderTextColor="#888"
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What's on your mind?"
              value={thoughtDescription}
              onChangeText={setThoughtDescription}
              multiline
              placeholderTextColor="#888"
            />
            <TextInput
              style={styles.input}
              placeholder="Tag"
              value={thoughtTag}
              onChangeText={setThoughtTag}
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
                setThoughtTitle('');
                setThoughtDescription('');
                setThoughtTag('');
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
});