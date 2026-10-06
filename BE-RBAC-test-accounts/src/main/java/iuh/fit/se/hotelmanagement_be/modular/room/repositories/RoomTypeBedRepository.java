package iuh.fit.se.hotelmanagement_be.modular.room.repositories;

import iuh.fit.se.hotelmanagement_be.modular.room.entities.RoomTypeBed;
import iuh.fit.se.hotelmanagement_be.modular.room.entities.enums.RoomType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RoomTypeBedRepository extends JpaRepository<RoomTypeBed, Long> {
    List<RoomTypeBed> findByRoomType(RoomType roomType);
    boolean existsByRoomTypeAndBedTypeId(RoomType roomType, Long bedTypeId);

}
