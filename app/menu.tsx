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

  useEffect(() => {
    const unsubscribeAuth = auth().onAuthStateChanged(user => {
      if (user) {
        setUserEmail(user.email ?? null);

        // Listen to all thoughts (feed) ordered by newest first
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

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>Logged in as {userEmail}</Text>

        <TouchableOpacity style={styles.addItemContainer} onPress={() => setShowForm(true)}>
          <Text style={styles.plusIcon}>＋</Text>
          <Text style={styles.addItemText}>Add New Thought</Text>
        </TouchableOpacity>

        {/* Thought Form Modal */}
        <Modal visible={showForm} animationType="slide" transparent={true} onRequestClose={() => setShowForm(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingThoughtId ? 'Edit Thought' : 'Add Thought'}</Text>

              <TextInput style={styles.input} placeholder="Title" value={thoughtTitle} onChangeText={setThoughtTitle} placeholderTextColor="#888" />
              <TextInput style={[styles.input, { height: 90 }]} placeholder="Description" value={thoughtDescription} onChangeText={setThoughtDescription} multiline placeholderTextColor="#888" />
              <TextInput style={styles.input} placeholder="Tag" value={thoughtTag} onChangeText={setThoughtTag} placeholderTextColor="#888" />

              <TouchableOpacity style={[styles.epiphanyToggle, isEpiphany && styles.epiphanyActive]} onPress={() => setIsEpiphany(!isEpiphany)}>
                <Text style={[styles.epiphanyText, isEpiphany && styles.epiphanyTextActive]}>
                  {isEpiphany ? '🌟 Epiphany!' : 'Mark as Epiphany'}
                </Text>
              </TouchableOpacity>

              {message ? <Text style={styles.message}>{message}</Text> : null}

              <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                <Text style={styles.buttonText}>{editingThoughtId ? 'Update' : 'Submit'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => {
                setShowForm(false);
                setEditingThoughtId(null);
                setThoughtTitle('');
                setThoughtDescription('');
                setThoughtTag('');
                setIsEpiphany(false);
                setMessage('');
              }}>
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Text style={styles.sectionTitle}>Thought Feed</Text>

        {thoughts.length === 0 ? (
          <Text style={styles.noItems}>No thoughts yet.</Text>
        ) : (
          <View style={styles.itemsContainer}>
            {thoughts.map(thought => (
              <View key={thought.id} style={[styles.itemCard, thought.epiphany && styles.epiphanyCard]}>
                <View style={styles.thoughtHeader}>
                  <Text style={styles.itemName}>{thought.title}</Text>
                  {thought.epiphany && <Text style={styles.epiphanyBadge}>🌟 Epiphany</Text>}
                </View>
                <Text style={styles.itemDescription}>{thought.description}</Text>
                <Text style={styles.itemTag}>#{thought.tag}</Text>
                <Text style={styles.postInfo}>
                  Posted by {thought.createdBy?.email || 'Unknown'} on {thought.createdAt ? new Date(thought.createdAt.seconds * 1000).toLocaleString() : '...'}
                </Text>

                <View style={styles.cardActions}>
                  {thought.createdBy?.uid === auth().currentUser?.uid && (
                    <>
                      <TouchableOpacity style={styles.cardButton} onPress={() => openFormForEdit(thought)}>
                        <Text style={styles.cardButtonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.cardButton, styles.deleteButton]} onPress={() => confirmDelete(thought.id!)}>
                        <Text style={[styles.cardButtonText, styles.deleteButtonText]}>Delete</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity style={[styles.cardButton, styles.epiphanyToggleBtn]} onPress={() => toggleEpiphany(thought)}>
                    <Text style={[styles.cardButtonText, thought.epiphany && styles.epiphanyTextActive]}>
                      {thought.epiphany ? 'Unmark Epiphany' : 'Mark Epiphany'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => auth().signOut().then(() => router.replace('/'))}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eaf9e2' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  subtitle: { fontSize: 18, color: '#2a9d8f', textAlign: 'center', marginBottom: 20 },
  addItemContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, justifyContent: 'center' },
  plusIcon: { fontSize: 40, color: '#264653', marginRight: 10 },
  addItemText: { fontSize: 18, fontWeight: '600', color: '#264653' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 16, width: '90%', maxWidth: 420, elevation: 5 },
  modalTitle: { fontSize: 22, fontWeight: '600', color: '#264653', textAlign: 'center', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#264653', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16, color: '#333', backgroundColor: '#fafafa' },
  epiphanyToggle: { padding: 8, borderRadius: 8, backgroundColor: '#f1f8f6', borderWidth: 1, borderColor: '#264653', marginBottom: 10, alignItems: 'center' },
  epiphanyActive: { backgroundColor: '#ffe066', borderColor: '#e9c46a' },
  epiphanyText: { color: '#264653', fontWeight: '600' },
  epiphanyTextActive: { color: '#e63946' },
  message: { color: '#e63946', textAlign: 'center', marginBottom: 15 },
  button: { backgroundColor: '#264653', padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#264653' },
  secondaryButtonText: { color: '#264653' },
  sectionTitle: { fontSize: 20, fontWeight: '600', marginBottom: 10, color: '#264653' },
  itemsContainer: { marginBottom: 20 },
  itemCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 5 },
  epiphanyCard: { borderWidth: 2, borderColor: '#ffe066', backgroundColor: '#fffbe6' },
  thoughtHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  epiphanyBadge: { backgroundColor: '#ffe066', color: '#e63946', fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontSize: 14 },
  itemName: { fontSize: 18, fontWeight: '600', color: '#264653' },
  itemDescription: { fontSize: 14, color: '#666' },
  itemTag: { fontSize: 14, color: '#264653', marginBottom: 4 },
  postInfo: { fontSize: 12, color: '#555', fontStyle: 'italic', marginBottom: 6 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 },
  cardButton: { backgroundColor: '#264653', padding: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 5, marginBottom: 5 },
  cardButtonText: { color: '#fff', fontSize: 14 },
  deleteButton: { backgroundColor: '#e63946' },
  deleteButtonText: { color: '#fff' },
  epiphanyToggleBtn: { backgroundColor: '#ffe066' },
  noItems: { textAlign: 'center', color: '#888', fontSize: 16, marginBottom: 20 },
  logoutButton: { backgroundColor: '#e63946', padding: 15, borderRadius: 8, marginTop: 10, alignItems: 'center' },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
