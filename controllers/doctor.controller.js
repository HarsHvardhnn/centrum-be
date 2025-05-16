// Helper function to generate default shifts
const generateDefaultShifts = () => {
  const defaultStartTime = "09:00";
  const defaultEndTime = "17:00";
  
  const days = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
    "Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"
  ];

  return days.map(day => ({
    dayOfWeek: day,
    startTime: defaultStartTime,
    endTime: defaultEndTime,
    status: "approved"
  }));
};

const addDoctor = async (req, res) => {
  try {
    const doctorData = req.body;

    const existingDoctor = await User.findOne({ email: doctorData.email });
    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        message: "Doctor with this email already exists",
      });
    } 
    // Create the base user document
    const userData = {
      name: {
        first: doctorData.name?.first || "",
        last: doctorData.name?.last || "",
      },
      email: doctorData.email,
      phone: doctorData.phone,
      specializations: doctorData.specializations,
      password: doctorData.password, // In production, this should be hashed
      role: "doctor", // This triggers the discriminator
      signupMethod: doctorData.signupMethod || "email",
      profilePicture: req.file?.path || "",
      singleSessionMode: doctorData.singleSessionMode || false,
    };

    // Generate default shifts for all days
    const defaultShifts = generateDefaultShifts();

    // Doctor-specific fields
    const doctorFields = {
      d_id: `dr-${Date.now()}`, // Generate unique ID
      specialization: doctorData.specialization || [],
      qualifications: doctorData.qualifications || [],
      experience: doctorData.experience || 0,
      bio: doctorData.bio || "",
      onlineConsultationFee: doctorData.onlineConsultationFee || 0,
      offlineConsultationFee: doctorData.offlineConsultationFee || 0,
      weeklyShifts: doctorData.weeklyShifts || defaultShifts, // Use provided shifts or default ones
      offSchedule: doctorData.offSchedule || [],
    };

    // Combine user and doctor fields
    const newDoctorData = { ...userData, ...doctorFields };

    // Create the doctor using the discriminator model
    const newDoctor = await Doctor.create(newDoctorData);

    // Format response object according to the required structure
    const responseDoctor = {
      id: newDoctor.d_id,
      name: `${newDoctor.name.first} ${newDoctor.name.last}`,
      specialty: newDoctor.specialization[0] || "",
      available: newDoctor.isAvailable, // This uses the virtual property from your schema
      status: newDoctor.isAvailable ? "Available" : "Unavailable",
      experience: `${newDoctor.experience} years`,
      image: newDoctor.profilePicture,
      visitType: "Consultation",
      date: new Date().toISOString().split("T")[0],
      email: newDoctor.email,
      phone: newDoctor.phone,
      qualifications: newDoctor.qualifications,
      specializations: newDoctor.specialization,
      bio: newDoctor.bio,
      consultationFee: newDoctor.consultationFee,
      offlineConsultationFee: newDoctor.offlineConsultationFee,
      weeklyShifts: newDoctor.weeklyShifts
    };

    res.status(201).json({
      success: true,
      message: "Doctor created successfully",
      doctor: responseDoctor,
    });
  } catch (error) {
    console.error("Error adding doctor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add doctor",
      error: error.message,
    });
  }
}; 